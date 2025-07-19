import Jimp from 'jimp';
import { DestructionSystem } from '../systems/DestructionSystem';
import { Vector2 } from '../../shared/types';

interface GridCell {
  x: number;
  y: number;
  color: string;
  type: 'wall' | 'spawn' | 'light' | 'empty';
  material?: string;
}

interface ProcessedWall {
  position: Vector2;
  width: number;
  height: number;
  material: 'concrete' | 'wood' | 'metal' | 'glass';
  actualLength?: number; // Optional: actual length in tiles for partial walls
  preDestroyedSlices?: number[]; // Optional: which slices to pre-destroy
}

interface WallPattern {
  x: number;
  y: number;
  rightExtent: number;
  downExtent: number;
  isLShape: boolean;
  isTShape: boolean;
  material: string;
}

export class MapLoader {
  private static readonly GRID_SIZE = 10;
  private static readonly MAP_WIDTH_CELLS = 48;
  private static readonly MAP_HEIGHT_CELLS = 27;
  
  // Maximum wall length to prevent slice stretching (5 tiles = 1 tile per slice)
  private static readonly MAX_WALL_LENGTH = 5;
  
  private static readonly COLOR_MAP: Record<string, string> = {
    // Wall Materials
    '#808080': 'concrete',
    '#8b4513': 'wood',
    '#404040': 'metal',
    '#87ceeb': 'glass',
    
    // Game Objects
    '#ff0000': 'spawn_red',
    '#0000ff': 'spawn_blue',
    '#ffff00': 'light',
    
    // Empty space
    '#ffffff': 'empty',
    '#000000': 'empty',
  };
  
  private destructionSystem: DestructionSystem;
  private grid: GridCell[][] = [];
  private spawns: Vector2[] = []; // Keep for backward compatibility
  private redSpawns: Vector2[] = [];
  private blueSpawns: Vector2[] = [];
  private lights: Vector2[] = [];
  
  constructor(destructionSystem: DestructionSystem) {
    this.destructionSystem = destructionSystem;
  }
  
  async loadMapFromFile(filename: string): Promise<void> {
    const mapPath = `./maps/${filename}.png`;
    
    try {
      // Load the image
      const image = await Jimp.read(mapPath);
      
      // Maps are now 48x27 directly
      if (image.bitmap.width !== 48 || image.bitmap.height !== 27) {
        throw new Error(`Map must be exactly 48x27 pixels, got ${image.bitmap.width}x${image.bitmap.height}`);
      }
      
      // Convert directly to grid (no downscaling needed!)
      this.imageToGrid(image);
      
      // Process grid into walls with smart orientation detection
      this.processGridToWalls();
      
    } catch (error) {
      console.error(`❌ Failed to load map ${filename}:`, error);
      throw error;
    }
  }
  
  private imageToGrid(image: Jimp): void {
    this.grid = [];
    this.spawns = [];
    this.redSpawns = [];
    this.blueSpawns = [];
    this.lights = [];
    
    for (let y = 0; y < 27; y++) {
      this.grid[y] = [];
      for (let x = 0; x < 48; x++) {
        const pixelColor = image.getPixelColor(x, y);
        const { r, g, b } = Jimp.intToRGBA(pixelColor);
        const hex = this.rgbToHex(r, g, b).toLowerCase();
        
        const cellType = MapLoader.COLOR_MAP[hex] || 'empty';
        
        const cell: GridCell = {
          x,
          y,
          color: hex,
          type: this.getTypeFromMaterial(cellType),
          material: this.isWallMaterial(cellType) ? cellType : undefined
        };
        
        this.grid[y][x] = cell;
        
        // Track special cells
        if (cellType === 'spawn_red') {
          this.redSpawns.push({ 
            x: x * MapLoader.GRID_SIZE + MapLoader.GRID_SIZE / 2, 
            y: y * MapLoader.GRID_SIZE + MapLoader.GRID_SIZE / 2 
          });
        } else if (cellType === 'spawn_blue') {
          this.blueSpawns.push({ 
            x: x * MapLoader.GRID_SIZE + MapLoader.GRID_SIZE / 2, 
            y: y * MapLoader.GRID_SIZE + MapLoader.GRID_SIZE / 2 
          });
        } else if (cellType === 'light') {
          this.lights.push({ 
            x: x * MapLoader.GRID_SIZE + MapLoader.GRID_SIZE / 2, 
            y: y * MapLoader.GRID_SIZE + MapLoader.GRID_SIZE / 2 
          });
        }
      }
    }
  }
  
  private processGridToWalls(): void {
    const walls: ProcessedWall[] = [];
    const visited = new Set<string>();
    
    // Process each unvisited wall cell
    for (let y = 0; y < 27; y++) {
      for (let x = 0; x < 48; x++) {
        const key = `${x},${y}`;
        if (visited.has(key) || this.grid[y][x].type !== 'wall') continue;
        
        // Analyze the wall pattern starting from this cell
        const pattern = this.analyzeWallPattern(x, y, visited);
        const material = this.grid[y][x].material!;
        
        // Convert pattern to optimal walls
        const optimalWalls = this.createOptimalWalls(pattern, material, visited);
        walls.push(...optimalWalls);
      }
    }
    
    // Create walls in the destruction system
    walls.forEach(wall => {
      const createdWall = this.destructionSystem.createWall({
        position: wall.position,
        width: wall.width,
        height: wall.height,
        material: wall.material
      });
      
      // If this wall has pre-destroyed slices, mark them as destroyed
      if (wall.preDestroyedSlices && wall.preDestroyedSlices.length > 0) {
        wall.preDestroyedSlices.forEach(sliceIndex => {
          // Mark slice as destroyed by setting health to 0
          this.destructionSystem.applyDamage(createdWall.id, sliceIndex, 999999); // Excessive damage to ensure destruction
        });
        
        console.log(`🧱 Created partial wall ${createdWall.id} (${wall.actualLength}/${5} slices), pre-destroyed slices: [${wall.preDestroyedSlices.join(', ')}]`);
      }
    });
  }
  
  // Analyze what kind of wall pattern we're looking at
  private analyzeWallPattern(startX: number, startY: number, visited: Set<string>): WallPattern {
    const material = this.grid[startY][startX].material!; // We know it's a wall, so material is defined
    
    // Look ahead to understand the shape
    let rightExtent = 0;
    let downExtent = 0;
    let isLShape = false;
    let isTShape = false;
    
    // Check horizontal extent (limited to prevent stretching)
    for (let x = startX; x < 48 && x < startX + MapLoader.MAX_WALL_LENGTH && this.isWallOfType(x, startY, material) && !visited.has(`${x},${startY}`); x++) {
      rightExtent++;
    }
    
    // Check vertical extent (limited to prevent stretching)
    for (let y = startY; y < 27 && y < startY + MapLoader.MAX_WALL_LENGTH && this.isWallOfType(startX, y, material) && !visited.has(`${startX},${y}`); y++) {
      downExtent++;
    }
    
    // Check for L-shape (wall extends both right and down)
    if (rightExtent >= 2 && downExtent >= 2) {
      // Check if there's a wall at the corner
      isLShape = this.isWallOfType(startX + 1, startY + 1, material);
    }
    
    // Check for T-shape patterns (with length limits)
    if (rightExtent >= 3 && downExtent >= 2) {
      // Check for T with stem going down
      const midX = startX + Math.floor(rightExtent / 2);
      isTShape = this.isWallOfType(midX, startY + 1, material);
    }
    
    return {
      x: startX,
      y: startY,
      rightExtent,
      downExtent,
      isLShape,
      isTShape,
      material
    };
  }
  
  // Create optimal walls based on the pattern
  private createOptimalWalls(pattern: WallPattern, material: string, visited: Set<string>): ProcessedWall[] {
    const walls: ProcessedWall[] = [];
    const { x, y, rightExtent, downExtent, isLShape, isTShape } = pattern;
    
    // Handle different patterns
    if (isLShape) {
      // L-shape: Create horizontal part first (usually more important)
      if (rightExtent > downExtent) {
        // Horizontal-dominant L
        walls.push(this.createHorizontalWall(x, y, rightExtent, material, visited));
        // Then create vertical part from the remainder
        for (let dy = 1; dy < downExtent; dy++) {
          if (!visited.has(`${x},${y + dy}`)) {
            const vertLength = this.measureVerticalExtent(x, y + dy, material, visited);
            if (vertLength > 0) {
              walls.push(this.createVerticalWall(x, y + dy, vertLength, material, visited));
            }
          }
        }
      } else {
        // Vertical-dominant L
        walls.push(this.createVerticalWall(x, y, downExtent, material, visited));
        // Then create horizontal part from the remainder
        for (let dx = 1; dx < rightExtent; dx++) {
          if (!visited.has(`${x + dx},${y}`)) {
            const horizLength = this.measureHorizontalExtent(x + dx, y, material, visited);
            if (horizLength > 0) {
              walls.push(this.createHorizontalWall(x + dx, y, horizLength, material, visited));
            }
          }
        }
      }
    } else if (isTShape) {
      // T-shape: Create the top bar first
      walls.push(this.createHorizontalWall(x, y, rightExtent, material, visited));
      // Then handle the stem
      const stemX = x + Math.floor(rightExtent / 2);
      for (let dy = 1; dy < 27 - y; dy++) {
        if (this.isWallOfType(stemX, y + dy, material) && !visited.has(`${stemX},${y + dy}`)) {
          const stemLength = this.measureVerticalExtent(stemX, y + dy, material, visited);
          if (stemLength > 0) {
            walls.push(this.createVerticalWall(stemX, y + dy, stemLength, material, visited));
            break;
          }
        }
      }
    } else if (rightExtent >= 2 && rightExtent > downExtent) {
      // Simple horizontal wall
      walls.push(this.createHorizontalWall(x, y, rightExtent, material, visited));
    } else if (downExtent >= 2) {
      // Simple vertical wall
      walls.push(this.createVerticalWall(x, y, downExtent, material, visited));
    } else {
      // Single cell - prefer vertical (as per your original logic)
      walls.push(this.createVerticalWall(x, y, 1, material, visited));
    }
    
    return walls;
  }
  
  // Helper methods
  private isWallOfType(x: number, y: number, material: string | undefined): boolean {
    return x >= 0 && x < 48 && y >= 0 && y < 27 && 
           this.grid[y][x].type === 'wall' && 
           this.grid[y][x].material === material;
  }
  
  private measureHorizontalExtent(x: number, y: number, material: string | undefined, visited: Set<string>): number {
    let length = 0;
    for (let dx = x; dx < 48 && dx < x + MapLoader.MAX_WALL_LENGTH && this.isWallOfType(dx, y, material) && !visited.has(`${dx},${y}`); dx++) {
      length++;
    }
    return length;
  }
  
  private measureVerticalExtent(x: number, y: number, material: string | undefined, visited: Set<string>): number {
    let length = 0;
    for (let dy = y; dy < 27 && dy < y + MapLoader.MAX_WALL_LENGTH && this.isWallOfType(x, dy, material) && !visited.has(`${x},${dy}`); dy++) {
      length++;
    }
    return length;
  }
  
  private createHorizontalWall(x: number, y: number, length: number, material: string, visited: Set<string>): ProcessedWall {
    // Mark cells as visited
    for (let dx = 0; dx < length; dx++) {
      visited.add(`${x + dx},${y}`);
    }
    
    // Always create a 5-slice wall, but mark unused slices as destroyed
    const SLICES_PER_WALL = 5;
    const preDestroyedSlices: number[] = [];
    
    // If wall is shorter than 5 tiles, mark the extra slices as pre-destroyed
    if (length < SLICES_PER_WALL) {
      for (let i = length; i < SLICES_PER_WALL; i++) {
        preDestroyedSlices.push(i);
      }
    }
    
    // Always create wall as if it were 5 tiles long (50 pixels) for consistent slicing
    const wallWidth = SLICES_PER_WALL * MapLoader.GRID_SIZE;
    
    return {
      position: { 
        x: x * MapLoader.GRID_SIZE, 
        y: y * MapLoader.GRID_SIZE 
      },
      width: wallWidth,
      height: MapLoader.GRID_SIZE,
      material: material as any,
      actualLength: length,
      preDestroyedSlices: preDestroyedSlices.length > 0 ? preDestroyedSlices : undefined
    };
  }
  
  private createVerticalWall(x: number, y: number, length: number, material: string, visited: Set<string>): ProcessedWall {
    // Mark cells as visited
    for (let dy = 0; dy < length; dy++) {
      visited.add(`${x},${y + dy}`);
    }
    
    // Always create a 5-slice wall, but mark unused slices as destroyed
    const SLICES_PER_WALL = 5;
    const preDestroyedSlices: number[] = [];
    
    // If wall is shorter than 5 tiles, mark the extra slices as pre-destroyed
    if (length < SLICES_PER_WALL) {
      for (let i = length; i < SLICES_PER_WALL; i++) {
        preDestroyedSlices.push(i);
      }
    }
    
    // Always create wall as if it were 5 tiles long (50 pixels) for consistent slicing
    const wallHeight = SLICES_PER_WALL * MapLoader.GRID_SIZE;
    
    return {
      position: { 
        x: x * MapLoader.GRID_SIZE, 
        y: y * MapLoader.GRID_SIZE 
      },
      width: MapLoader.GRID_SIZE,
      height: wallHeight,
      material: material as any,
      actualLength: length,
      preDestroyedSlices: preDestroyedSlices.length > 0 ? preDestroyedSlices : undefined
    };
  }
  
  private rgbToHex(r: number, g: number, b: number): string {
    return '#' + [r, g, b].map(x => {
      const hex = x.toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    }).join('');
  }
  
  private getTypeFromMaterial(material: string): 'wall' | 'spawn' | 'light' | 'empty' {
    if (this.isWallMaterial(material)) return 'wall';
    if (material.startsWith('spawn_')) return 'spawn';
    if (material === 'light') return 'light';
    return 'empty';
  }
  
  private isWallMaterial(material: string): boolean {
    return ['concrete', 'wood', 'metal', 'glass'].includes(material);
  }
  
  // Getters for game systems that need spawn/light positions
  getSpawnPositions(): Vector2[] {
    return [...this.redSpawns, ...this.blueSpawns];
  }
  
  getTeamSpawnPositions(): { red: Vector2[], blue: Vector2[] } {
    return {
      red: [...this.redSpawns],
      blue: [...this.blueSpawns]
    };
  }
  
  getLightPositions(): Vector2[] {
    return [...this.lights];
  }
} 