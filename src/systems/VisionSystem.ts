import { PlayerState, WallState, Vector2 } from '../../shared/types';
import { GAME_CONFIG } from '../../shared/constants';

export interface VisionState {
  playerId: string;
  visiblePixels: Set<string>; // "x,y" format
  visiblePlayers: Set<string>;
  viewAngle: number;
  lastPosition: Vector2;
  lastCalculated: number;
  cacheValid: boolean;
}

export class VisionSystem {
  private visionCache: Map<string, VisionState> = new Map();
  private scanlineBuffer: Uint8Array;
  private lastWallUpdate: number = 0;
  private wallBounds: Map<string, {minX: number, maxX: number, minY: number, maxY: number}> = new Map();
  
  constructor() {
    // Bit-packed array for visibility (1 bit per pixel)
    const pixelCount = GAME_CONFIG.GAME_WIDTH * GAME_CONFIG.GAME_HEIGHT;
    this.scanlineBuffer = new Uint8Array(Math.ceil(pixelCount / 8));
    console.log('VisionSystem initialized with buffer size:', this.scanlineBuffer.length);
  }
  
  // Update wall boundaries for optimization
  private updateWallBounds(walls: Map<string, WallState>): void {
    this.wallBounds.clear();
    for (const [id, wall] of walls) {
      // Skip boundary walls
      if (wall.position.x < 0 || wall.position.y < 0) continue;
      
      this.wallBounds.set(id, {
        minX: wall.position.x,
        maxX: wall.position.x + wall.width,
        minY: wall.position.y,
        maxY: wall.position.y + wall.height
      });
    }
  }
  
  // Main entry point for vision calculation
  calculateVision(
    player: PlayerState,
    walls: Map<string, WallState>,
    wallsUpdated: boolean = false
  ): VisionState {
    // Invalidate cache if walls updated
    if (wallsUpdated) {
      this.lastWallUpdate = Date.now();
      this.visionCache.clear();
      this.updateWallBounds(walls);
    }
    
    // Initialize wall bounds if empty
    if (this.wallBounds.size === 0) {
      this.updateWallBounds(walls);
    }
    
    const cached = this.visionCache.get(player.id);
    
    // Use cache if still valid
    if (cached && this.isCacheValid(player, cached)) {
      return cached;
    }
    
    // Clear buffer for new calculation
    this.scanlineBuffer.fill(0);
    
    // Create new vision state
    const vision: VisionState = {
      playerId: player.id,
      visiblePixels: new Set(),
      visiblePlayers: new Set(),
      viewAngle: player.transform.rotation,
      lastPosition: { ...player.transform.position },
      lastCalculated: Date.now(),
      cacheValid: true
    };
    
    // Calculate three vision components
    // 1. Main vision cone (120° forward)
    this.calculateMainVision(
      player.transform.position,
      player.transform.rotation,
      walls,
      vision.visiblePixels
    );
    
    // 2. Peripheral vision (30px radius, excluding 90° behind)
    this.calculatePeripheralVision(
      player.transform.position,
      player.transform.rotation,
      walls,
      vision.visiblePixels
    );
    
    // 3. Extended vision in mouse direction
    this.calculateExtendedVision(
      player.transform.position,
      player.transform.rotation,
      walls,
      vision.visiblePixels
    );
    
    // Cache the result
    this.visionCache.set(player.id, vision);
    
    // Debug logging - DISABLED FOR PERFORMANCE
    // if (Math.random() < 0.05) { // 5% chance
    //   console.log(`👁️ VISION ${player.id.substring(0, 8)}: ${vision.visiblePixels.size} pixels visible`);
    // }
    
    return vision;
  }
  
  // Check if cached vision is still valid
  private isCacheValid(player: PlayerState, cached: VisionState): boolean {
    const timeDiff = Date.now() - cached.lastCalculated;
    if (timeDiff > 200) return false; // 200ms max cache (was 100ms)
    
    // Check if player moved significantly
    const posDiff = Math.abs(player.transform.position.x - cached.lastPosition.x) +
                    Math.abs(player.transform.position.y - cached.lastPosition.y);
    if (posDiff > 5) return false; // Moved more than 5 pixels (was 2)
    
    // Check if player rotated significantly
    const rotDiff = Math.abs(player.transform.rotation - cached.viewAngle);
    if (rotDiff > 0.174) return false; // Rotated more than 10 degrees (was 5)
    
    // Check if walls were updated since cache
    if (this.lastWallUpdate > cached.lastCalculated) return false;
    
    return true;
  }
  
  // Calculate main 120° vision cone using scanline algorithm
  private calculateMainVision(
    origin: Vector2,
    centerAngle: number,
    walls: Map<string, WallState>,
    visiblePixels: Set<string>
  ): void {
    const x0 = Math.floor(origin.x);
    const y0 = Math.floor(origin.y);
    
    // Calculate FOV bounds (120° total, 60° each side)
    const fovHalf = (120 / 2) * Math.PI / 180;
    const leftAngle = centerAngle - fovHalf;
    const rightAngle = centerAngle + fovHalf;
    
    // Stack for scanline segments
    interface ScanlineSegment {
      y: number;
      x1: number;
      x2: number;
      dy: number;
    }
    const stack: ScanlineSegment[] = [];
    
    // Start with initial scanline through origin
    stack.push({ y: y0, x1: x0, x2: x0, dy: -1 });
    stack.push({ y: y0, x1: x0, x2: x0, dy: 1 });
    
    // Mark origin as visible
    this.setVisible(x0, y0, visiblePixels);
    
    // Process scanlines
    while (stack.length > 0) {
      const segment = stack.pop()!;
      const y = segment.y + segment.dy;
      
      // Skip if out of bounds
      if (y < 0 || y >= GAME_CONFIG.GAME_HEIGHT) continue;
      
      // Process the scanline in segments to handle walls properly
      let currentX = segment.x1;
      
      while (currentX <= segment.x2) {
        // Skip past any walls at current position
        while (currentX <= segment.x2 && 
               this.isWallBlocking(currentX, y, walls)) {
          currentX++;
        }
        
        if (currentX > segment.x2) break;
        
        // Found start of a visible segment
        let segmentStart = currentX;
        let segmentEnd = currentX;
        
        // Scan left from current position
        for (let x = currentX - 1; x >= 0; x--) {
          if (!this.inMainFOV(x, y, x0, y0, leftAngle, rightAngle, GAME_CONFIG.VISION_RANGE)) {
            break;
          }
          
          if (this.isWallBlocking(x, y, walls)) {
            break;
          }
          
          segmentStart = x;
          this.setVisible(x, y, visiblePixels);
        }
        
        // Scan right from current position
        for (let x = currentX; x < GAME_CONFIG.GAME_WIDTH; x++) {
          if (!this.inMainFOV(x, y, x0, y0, leftAngle, rightAngle, GAME_CONFIG.VISION_RANGE)) {
            break;
          }
          
          if (this.isWallBlocking(x, y, walls)) {
            break;
          }
          
          segmentEnd = x;
          this.setVisible(x, y, visiblePixels);
          
          // Don't scan beyond parent segment bounds
          if (x >= segment.x2) break;
        }
        
        // Add this visible segment to the stack for next row
        if (segmentEnd >= segmentStart) {
          stack.push({ y, x1: segmentStart, x2: segmentEnd, dy: segment.dy });
        }
        
        // Move to next potential segment
        currentX = segmentEnd + 1;
      }
    }
  }
  
  // Calculate peripheral vision (30px radius, excluding 90° blind spot behind)
  private calculatePeripheralVision(
    origin: Vector2,
    centerAngle: number,
    walls: Map<string, WallState>,
    visiblePixels: Set<string>
  ): void {
    const x0 = Math.floor(origin.x);
    const y0 = Math.floor(origin.y);
    const radius = 30;
    
    // Calculate blind spot angles (90° behind player)
    const blindAngleStart = centerAngle + Math.PI - (Math.PI / 4); // -45° from back
    const blindAngleEnd = centerAngle + Math.PI + (Math.PI / 4);   // +45° from back
    
    // Simple circle scan
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const x = x0 + dx;
        const y = y0 + dy;
        
        // Check bounds
        if (x < 0 || x >= GAME_CONFIG.GAME_WIDTH || 
            y < 0 || y >= GAME_CONFIG.GAME_HEIGHT) continue;
        
        // Check distance
        const distSq = dx * dx + dy * dy;
        if (distSq > radius * radius) continue;
        
        // Check if in blind spot
        const angle = Math.atan2(dy, dx);
        if (this.inBlindSpot(angle, blindAngleStart, blindAngleEnd)) continue;
        
        // Simple line-of-sight check
        if (this.hasLineOfSight(x0, y0, x, y, walls)) {
          this.setVisible(x, y, visiblePixels);
        }
      }
    }
  }
  
  // Calculate extended vision in mouse direction
  private calculateExtendedVision(
    origin: Vector2,
    mouseAngle: number,
    walls: Map<string, WallState>,
    visiblePixels: Set<string>
  ): void {
    const x0 = Math.floor(origin.x);
    const y0 = Math.floor(origin.y);
    const extendedRange = GAME_CONFIG.VISION_RANGE * 1.3;
    
    // Cast rays in a narrow cone (30°) in mouse direction
    const coneHalf = (30 / 2) * Math.PI / 180;
    
    for (let angleOffset = -coneHalf; angleOffset <= coneHalf; angleOffset += 0.02) {
      const angle = mouseAngle + angleOffset;
      const dx = Math.cos(angle);
      const dy = Math.sin(angle);
      
      // Cast ray
      for (let dist = 0; dist < extendedRange; dist++) {
        const x = Math.floor(x0 + dx * dist);
        const y = Math.floor(y0 + dy * dist);
        
        // Check bounds
        if (x < 0 || x >= GAME_CONFIG.GAME_WIDTH || 
            y < 0 || y >= GAME_CONFIG.GAME_HEIGHT) break;
        
        // Check if blocked by wall
        if (this.isWallBlocking(x, y, walls)) break;
        
        this.setVisible(x, y, visiblePixels);
      }
    }
  }
  
  // Check if point is in main FOV
  private inMainFOV(x: number, y: number, x0: number, y0: number,
                    leftAngle: number, rightAngle: number, maxRange: number): boolean {
    const dx = x - x0;
    const dy = y - y0;
    const distSq = dx * dx + dy * dy;
    
    // Range check
    if (distSq > maxRange * maxRange) return false;
    
    // Angle check
    const angle = Math.atan2(dy, dx);
    return this.angleInRange(angle, leftAngle, rightAngle);
  }
  
  // Check if angle is in blind spot
  private inBlindSpot(angle: number, blindStart: number, blindEnd: number): boolean {
    // Normalize angles to [0, 2π]
    const normalizeAngle = (a: number) => {
      while (a < 0) a += 2 * Math.PI;
      while (a >= 2 * Math.PI) a -= 2 * Math.PI;
      return a;
    };
    
    const normAngle = normalizeAngle(angle);
    const normStart = normalizeAngle(blindStart);
    const normEnd = normalizeAngle(blindEnd);
    
    if (normStart <= normEnd) {
      return normAngle >= normStart && normAngle <= normEnd;
    } else {
      return normAngle >= normStart || normAngle <= normEnd;
    }
  }
  
  // Check if angle is within range (handles wrap-around)
  private angleInRange(angle: number, start: number, end: number): boolean {
    // Normalize angles to [-π, π]
    const normalize = (a: number) => {
      while (a > Math.PI) a -= 2 * Math.PI;
      while (a < -Math.PI) a += 2 * Math.PI;
      return a;
    };
    
    angle = normalize(angle);
    start = normalize(start);
    end = normalize(end);
    
    if (start <= end) {
      return angle >= start && angle <= end;
    } else {
      return angle >= start || angle <= end;
    }
  }
  
  // Simple line-of-sight check using Bresenham's algorithm
  private hasLineOfSight(x0: number, y0: number, x1: number, y1: number,
                         walls: Map<string, WallState>): boolean {
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    
    let x = x0;
    let y = y0;
    
    while (true) {
      // Don't check the start or end points
      if ((x !== x0 || y !== y0) && (x !== x1 || y !== y1)) {
        if (this.isWallBlocking(x, y, walls)) {
          return false;
        }
      }
      
      if (x === x1 && y === y1) break;
      
      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x += sx;
      }
      if (e2 < dx) {
        err += dx;
        y += sy;
      }
    }
    
    return true;
  }
  
  // Check if a pixel position has a wall - OPTIMIZED
  private isWallBlocking(x: number, y: number, walls: Map<string, WallState>): boolean {
    // Use pre-computed bounds for 10x speedup
    for (const [wallId, bounds] of this.wallBounds) {
      // Early exit - skip walls that can't contain this point
      if (x < bounds.minX || x >= bounds.maxX || 
          y < bounds.minY || y >= bounds.maxY) {
        continue;
      }
      
      // Only check walls that could contain this pixel
      const wall = walls.get(wallId);
      if (!wall) continue;
      
      // Check which slice this pixel is in
      const sliceWidth = wall.width / GAME_CONFIG.DESTRUCTION.WALL_SLICES;
      const sliceIndex = Math.floor((x - wall.position.x) / sliceWidth);
      
      // Check if this slice is intact
      if (wall.destructionMask[sliceIndex] === 0) {
        return true; // Wall is blocking
      }
    }
    
    return false;
  }
  
  // Mark a pixel as visible using bit array
  private setVisible(x: number, y: number, visiblePixels: Set<string>): void {
    const index = y * GAME_CONFIG.GAME_WIDTH + x;
    const byteIndex = Math.floor(index / 8);
    const bitIndex = index % 8;
    
    // Check if already visible
    if (this.scanlineBuffer[byteIndex] & (1 << bitIndex)) return;
    
    // Mark as visible
    this.scanlineBuffer[byteIndex] |= (1 << bitIndex);
    visiblePixels.add(`${x},${y}`);
  }
  
  // Check which players are visible from a given vision state
  checkVisiblePlayers(vision: VisionState, players: Map<string, PlayerState>): void {
    vision.visiblePlayers.clear();
    
    for (const [playerId, player] of players) {
      if (playerId === vision.playerId) continue; // Skip self
      
      // Check if player position is visible
      const x = Math.floor(player.transform.position.x);
      const y = Math.floor(player.transform.position.y);
      
      if (vision.visiblePixels.has(`${x},${y}`)) {
        vision.visiblePlayers.add(playerId);
      }
    }
  }
  
  // Clear vision cache (call when walls are destroyed)
  clearCache(): void {
    this.visionCache.clear();
    this.lastWallUpdate = Date.now();
  }
  
  // Get cache statistics for debugging
  getCacheStats(): { size: number; entries: string[] } {
    return {
      size: this.visionCache.size,
      entries: Array.from(this.visionCache.keys())
    };
  }
} 