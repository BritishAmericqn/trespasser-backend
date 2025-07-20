import { Vector2 } from '../../shared/types';
import { GAME_CONFIG } from '../../shared/constants';
import type { PlayerState } from '../../shared/types';
import { 
  getSliceBoundaryPosition,
  calculateSliceIndex,
  getSliceDimension,
  shouldAllowVisionThrough,
  shouldSliceBlockVision,
  shouldSliceBlockVisionByHealth,
  shouldSliceAllowVision
} from '../utils/wallSliceHelpers';

interface Corner {
  x: number;
  y: number;
  angle: number;
  distance: number;
  wallId: string;
}

interface Wall {
  id: string;
  position: Vector2;
  width: number;
  height: number;
  orientation: 'horizontal' | 'vertical'; // Added orientation
  destroyedSlices: number;
  material: string; // Added material
  sliceHealth: number[]; // Health of each slice
  maxHealth: number; // Maximum health per slice
}

export class VisibilityPolygonSystem {
  private walls: Map<string, Wall> = new Map();
  private viewAngle: number = (120 * Math.PI) / 180; // 120 degrees in radians
  private viewDistance: number = 160; // Maximum view distance
  
  constructor() {
    console.log('VisibilityPolygonSystem initialized');
  }

  /**
   * Initialize walls from destruction system format
   */
  initializeWalls(wallData: Array<{id: string, x: number, y: number, width: number, height: number, material: string, sliceHealth: number[], maxHealth: number, destructionMask?: Uint8Array | number[]}>) {
    this.walls.clear();
    
    wallData.forEach((wall) => {
      // Convert destructionMask array to bitmask
      let destroyedSlices = 0;
      if (wall.destructionMask) {
        const mask = Array.isArray(wall.destructionMask) ? wall.destructionMask : Array.from(wall.destructionMask);
        for (let i = 0; i < 5; i++) {
          if (mask[i] === 1) {
            destroyedSlices |= (1 << i);
          }
        }

      }
      
      this.walls.set(wall.id, {
        id: wall.id,
        position: { x: wall.x, y: wall.y },
        width: wall.width,
        height: wall.height,
        orientation: wall.width > wall.height ? 'horizontal' : 'vertical',
        destroyedSlices: destroyedSlices,
        material: wall.material,
        sliceHealth: [...wall.sliceHealth],
        maxHealth: wall.maxHealth
      });
    });
    
    // Wall initialization debug removed for performance
  }

  /**
   * Add a single wall (for dynamically created walls)
   */
  addWall(wallId: string, wall: { position: Vector2; width: number; height: number; material: string; sliceHealth: number[]; maxHealth: number }) {
    this.walls.set(wallId, {
      id: wallId,
      position: { x: wall.position.x, y: wall.position.y },
      width: wall.width,
      height: wall.height,
      orientation: wall.width > wall.height ? 'horizontal' : 'vertical',
      destroyedSlices: 0,
      material: wall.material,
      sliceHealth: [...wall.sliceHealth],
      maxHealth: wall.maxHealth
    });
    // console.log(`[VisibilityPolygon] Added wall ${wallId}`);
  }

  /**
   * Remove a wall (for fully destroyed walls)
   */
  removeWall(wallId: string) {
    if (this.walls.delete(wallId)) {
      // console.log(`[VisibilityPolygon] Removed wall ${wallId}`);
    }
  }

  /**
   * Update wall destruction state
   */
  onWallDestroyed(wallId: string, wall: { position: Vector2; width: number; height: number; material: string; sliceHealth: number[]; maxHealth: number }, sliceIndex: number) {
    const storedWall = this.walls.get(wallId);
    if (storedWall) {
      const oldMask = storedWall.destroyedSlices;
      
      // Update slice health
      storedWall.sliceHealth[sliceIndex] = wall.sliceHealth[sliceIndex];
      
      // Update bitmask based on health-based visibility logic
      const shouldAllowVision = shouldSliceAllowVision(wall.material, wall.sliceHealth[sliceIndex], wall.maxHealth);
      if (shouldAllowVision) {
        storedWall.destroyedSlices |= (1 << sliceIndex);
      } else {
        storedWall.destroyedSlices &= ~(1 << sliceIndex);
      }
      
      // console.log(`[VisibilityPolygon] Wall ${wallId} slice ${sliceIndex} updated. Health: ${wall.sliceHealth[sliceIndex]}, Mask: ${oldMask.toString(2).padStart(5, '0')} → ${storedWall.destroyedSlices.toString(2).padStart(5, '0')}`);
    } else {
      console.warn(`[VisibilityPolygon] Wall ${wallId} not found in visibility system!`);
    }
  }

  /**
   * Calculate visibility polygon from a given position
   */
  calculateVisibility(viewerPos: Vector2, viewDirection: number): Vector2[] {
    // Step 1: Find all wall corners within range and FOV
    const corners = this.findVisibleCorners(viewerPos, viewDirection);
    
    // Step 2: Define view cone boundaries
    const leftBound = viewDirection - this.viewAngle / 2;
    const rightBound = viewDirection + this.viewAngle / 2;
    
    // Step 3: Build list of all angles to cast rays, ensuring they're within FOV
    const angles: number[] = [];
    
    // Always include boundaries, but normalize them
    const normalizeAngle = (angle: number): number => {
      let normalized = angle % (2 * Math.PI);
      if (normalized > Math.PI) normalized -= 2 * Math.PI;
      if (normalized < -Math.PI) normalized += 2 * Math.PI;
      return normalized;
    };
    
    angles.push(normalizeAngle(leftBound));
    angles.push(normalizeAngle(rightBound));
    
    // Add corner angles with epsilon, but only if they're within FOV
    const epsilon = 0.0001;
    for (const corner of corners) {
      // Corner angles are already filtered to be within FOV in findVisibleCorners
      angles.push(normalizeAngle(corner.angle - epsilon));
      angles.push(normalizeAngle(corner.angle + epsilon));
    }
    
    // Filter out any angles that somehow ended up outside FOV
    const fovAngles = angles.filter(angle => {
      return this.isAngleInViewCone(angle, leftBound, rightBound);
    });
    
    // Remove duplicates and sort
    const uniqueAngles = Array.from(new Set(fovAngles));
    
    // Sort angles properly, handling wrap-around
    uniqueAngles.sort((a, b) => {
      // Normalize to view direction to handle wrap-around
      let relA = a - viewDirection;
      let relB = b - viewDirection;
      
      // Normalize to [-PI, PI]
      while (relA > Math.PI) relA -= 2 * Math.PI;
      while (relA < -Math.PI) relA += 2 * Math.PI;
      while (relB > Math.PI) relB -= 2 * Math.PI;
      while (relB < -Math.PI) relB += 2 * Math.PI;
      
      return relA - relB;
    });
    
    // Debug: Check if any angles are outside normal range
    const abnormalAngles = uniqueAngles.filter(a => a < -Math.PI || a > Math.PI);
    if (abnormalAngles.length > 0) {
      // console.log(`[AngleDebug] Found angles outside [-π, π] range:`);
      // abnormalAngles.forEach(a => {
      //   console.log(`  - ${(a * 180 / Math.PI).toFixed(1)}° (${a.toFixed(3)} rad)`);
      // });
      // console.log(`  - This suggests a normalization issue`);
    }
    
    // Step 4: Build the visibility polygon
    const visibilityPoints: Vector2[] = [];
    const pointsOnArc: boolean[] = []; // Track which points are on the arc
    
    // Start with player position
    visibilityPoints.push({ ...viewerPos });
    pointsOnArc.push(false);
    
    // Cast rays and collect hit points
    for (let i = 0; i < uniqueAngles.length; i++) {
      const angle = uniqueAngles[i];
      const hitPoint = this.castRay(viewerPos, angle);
      
      if (hitPoint) {
        // Check if hit point is at max distance (on the arc)
        const dist = Math.hypot(hitPoint.x - viewerPos.x, hitPoint.y - viewerPos.y);
        const isOnArc = Math.abs(dist - this.viewDistance) < 0.1; // Small tolerance
        
        visibilityPoints.push(hitPoint);
        pointsOnArc.push(isOnArc);
      }
    }
    
    // The polygon will close automatically back to the first point (player position)
    
    // Post-process: Add arc interpolation between consecutive arc points
    const finalPoints: Vector2[] = [];
    finalPoints.push(visibilityPoints[0]); // Start with viewer position
    
    for (let i = 1; i < visibilityPoints.length; i++) {
      const prevOnArc = pointsOnArc[i - 1];
      const currOnArc = pointsOnArc[i];
      
      if (prevOnArc && currOnArc && i > 1) { // Both points on arc (skip first point which is viewer)
        // Add interpolated arc points between them
        const prevPoint = visibilityPoints[i - 1];
        const currPoint = visibilityPoints[i];
        
        const prevAngle = Math.atan2(prevPoint.y - viewerPos.y, prevPoint.x - viewerPos.x);
        const currAngle = Math.atan2(currPoint.y - viewerPos.y, currPoint.x - viewerPos.x);
        
        let angleDiff = currAngle - prevAngle;
        // Normalize angle difference to [-π, π]
        while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
        while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
        
        // Only interpolate if the angular gap is significant
        const maxAngleGap = Math.PI / 18; // 10 degrees
        if (Math.abs(angleDiff) > maxAngleGap) {
          const numInterpolated = Math.ceil(Math.abs(angleDiff) / maxAngleGap) - 1;
          for (let j = 1; j <= numInterpolated; j++) {
            const t = j / (numInterpolated + 1);
            const interpAngle = prevAngle + angleDiff * t;
            const interpPoint = {
              x: viewerPos.x + Math.cos(interpAngle) * this.viewDistance,
              y: viewerPos.y + Math.sin(interpAngle) * this.viewDistance
            };
            finalPoints.push(interpPoint);
          }
        }
      }
      
      finalPoints.push(visibilityPoints[i]);
    }
    
    // Debug: Log basic info about the polygon (temporarily increased for testing)
    if (finalPoints.length > 10) { // Log more frequently for testing
      const arcPointCount = pointsOnArc.filter(p => p).length;
      // Removed debug logging - vision system working perfectly
    }
    
    return finalPoints;
  }

  /**
   * Check if an angle is within the view cone
   */
  private isAngleInViewCone(angle: number, leftBound: number, rightBound: number): boolean {
    // Normalize angles to [0, 2π]
    const normalizeAngle = (a: number) => {
      let normalized = a % (2 * Math.PI);
      if (normalized < 0) normalized += 2 * Math.PI;
      return normalized;
    };
    
    const normAngle = normalizeAngle(angle);
    const normLeft = normalizeAngle(leftBound);
    const normRight = normalizeAngle(rightBound);
    
    // Handle wrap-around case
    if (normLeft > normRight) {
      return normAngle >= normLeft || normAngle <= normRight;
    } else {
      return normAngle >= normLeft && normAngle <= normRight;
    }
  }

  /**
   * Calculate the actual bounds of a wall based on intact slices
   */
  private getActualWallBounds(wall: Wall): { minX: number, maxX: number, minY: number, maxY: number } {
    // If wall is fully intact, return full bounds
    if (wall.destroyedSlices === 0) {
      return {
        minX: wall.position.x,
        maxX: wall.position.x + wall.width,
        minY: wall.position.y,
        maxY: wall.position.y + wall.height
      };
    }
    
    // If wall is fully destroyed, return empty bounds
    if (wall.destroyedSlices === 0b11111) {
      return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
    }
    
    // Find first and last intact slices
    let firstIntactSlice = -1;
    let lastIntactSlice = -1;
    
    for (let i = 0; i < 5; i++) {
      const isDestroyed = (wall.destroyedSlices >> i) & 1;
      if (!isDestroyed) {
        if (firstIntactSlice === -1) firstIntactSlice = i;
        lastIntactSlice = i;
      }
    }
    
    // If no intact slices found, return empty bounds
    if (firstIntactSlice === -1) {
      return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
    }
    
    const sliceDimension = getSliceDimension(wall as any);
    
    if (wall.orientation === 'horizontal') {
      // For horizontal walls, adjust X bounds based on intact slices
      const minX = wall.position.x + (firstIntactSlice * sliceDimension);
      const maxX = wall.position.x + ((lastIntactSlice + 1) * sliceDimension);
      

      
      return {
        minX: minX,
        maxX: maxX,
        minY: wall.position.y,
        maxY: wall.position.y + wall.height
      };
    } else {
      // For vertical walls, adjust Y bounds based on intact slices
      const minY = wall.position.y + (firstIntactSlice * sliceDimension);
      const maxY = wall.position.y + ((lastIntactSlice + 1) * sliceDimension);
      

      
      return {
        minX: wall.position.x,
        maxX: wall.position.x + wall.width,
        minY: minY,
        maxY: maxY
      };
    }
  }

  /**
   * Get all wall corners for visibility calculation
   * Let FOV filtering and ray casting determine actual visibility
   */
  private getAllWallCorners(wall: Wall, viewerPos: Vector2): Vector2[] {
    const corners: Vector2[] = [];
    

    
    // Get actual bounds based on intact slices
    const bounds = this.getActualWallBounds(wall);
    
    // If wall has no intact slices, return no corners
    if (bounds.minX === bounds.maxX || bounds.minY === bounds.maxY) {
      return corners;
    }
    
    // Add corners based on actual bounds (not full wall dimensions)
    corners.push({ x: bounds.minX, y: bounds.minY });   // Top-left of intact area
    corners.push({ x: bounds.maxX, y: bounds.minY });   // Top-right of intact area
    corners.push({ x: bounds.minX, y: bounds.maxY });   // Bottom-left of intact area
    corners.push({ x: bounds.maxX, y: bounds.maxY });   // Bottom-right of intact area
    
    // Also add corners created by destruction if the wall is partially destroyed
    if (wall.destroyedSlices !== 0 && wall.destroyedSlices !== 0b11111) {
      const sliceDimension = getSliceDimension(wall as any);
      let addedCorners = 0;
      
      // Check each boundary between slices
      for (let i = 0; i <= 5; i++) {
        const adjacentSliceIndices = wall.orientation === 'horizontal' 
          ? { first: i - 1, second: i }  // left/right for horizontal
          : { first: i - 1, second: i }; // top/bottom for vertical
        
        // Get destruction state of adjacent slices
        const firstDestroyed = adjacentSliceIndices.first >= 0 && adjacentSliceIndices.first < 5 
          ? (wall.destroyedSlices >> adjacentSliceIndices.first) & 1 
          : 0;
        const secondDestroyed = adjacentSliceIndices.second >= 0 && adjacentSliceIndices.second < 5 
          ? (wall.destroyedSlices >> adjacentSliceIndices.second) & 1 
          : 0;
        
        // Add corners where destruction state changes
        if (firstDestroyed !== secondDestroyed) {
          const boundaryPos = getSliceBoundaryPosition(wall as any, i);
          
          if (wall.orientation === 'horizontal') {
            // Add both top and bottom corners at this vertical boundary
            corners.push({ x: boundaryPos, y: wall.position.y });
            corners.push({ x: boundaryPos, y: wall.position.y + wall.height });
          } else {
            // Add both left and right corners at this horizontal boundary
            corners.push({ x: wall.position.x, y: boundaryPos });
            corners.push({ x: wall.position.x + wall.width, y: boundaryPos });
          }
          addedCorners += 2;
        }
      }
    }
    
    return corners;
  }

  /**
   * Find all wall corners that might affect visibility
   */
  private findVisibleCorners(viewerPos: Vector2, viewDirection: number): Corner[] {
    const corners: Corner[] = [];
    const cornerMap = new Map<string, Corner>(); // Deduplicate shared corners
    const leftBound = viewDirection - this.viewAngle / 2;
    const rightBound = viewDirection + this.viewAngle / 2;
    
    // First, collect all potential corners
    this.walls.forEach((wall) => {
      // Skip fully destroyed walls
      if (wall.destroyedSlices === 0b11111) return;
      
      // Get all corners of the wall (no filtering)
      const wallCorners = this.getAllWallCorners(wall, viewerPos);
      
      // Also check for arc-edge intersections using actual wall bounds
      const bounds = this.getActualWallBounds(wall);
      const edges = [
        { start: { x: bounds.minX, y: bounds.minY }, 
          end: { x: bounds.maxX, y: bounds.minY } }, // Top
        { start: { x: bounds.maxX, y: bounds.minY }, 
          end: { x: bounds.maxX, y: bounds.maxY } }, // Right
        { start: { x: bounds.maxX, y: bounds.maxY }, 
          end: { x: bounds.minX, y: bounds.maxY } }, // Bottom
        { start: { x: bounds.minX, y: bounds.maxY }, 
          end: { x: bounds.minX, y: bounds.minY } } // Left
      ];
      
      // Find arc intersections for each edge
      for (const edge of edges) {
        const arcIntersections = this.findArcEdgeIntersections(edge, viewerPos, viewDirection);
        for (const intersection of arcIntersections) {
          wallCorners.push(intersection);
        }
      }
      
      // Process all corners (wall corners + arc intersections)
      for (const corner of wallCorners) {
        const dx = corner.x - viewerPos.x;
        const dy = corner.y - viewerPos.y;
        const distance = Math.hypot(dx, dy);
        
        // Skip if beyond view distance
        if (distance > this.viewDistance) {
          continue;
        }
        
        // Calculate angle and check if within view cone
        let angle = Math.atan2(dy, dx);
        
        // Use the same wraparound-aware FOV check as isAngleInViewCone
        if (!this.isAngleInViewCone(angle, leftBound, rightBound)) {
          continue;
        }
        
        // Use position as key to deduplicate shared corners
        const key = `${corner.x},${corner.y}`;
        if (!cornerMap.has(key) || cornerMap.get(key)!.distance > distance) {
          cornerMap.set(key, {
            x: corner.x,
            y: corner.y,
            angle: angle,
            distance: distance,
            wallId: wall.id
          });
        }
      }
    });
    
    // Convert map to array
    const validCorners: Corner[] = Array.from(cornerMap.values());
    
    return validCorners;
  }

  /**
   * Get wall corners including those created by destruction
   */
  private getWallCorners(wall: Wall): Vector2[] {
    const corners: Vector2[] = [];
    
    // Always add outer corners
    corners.push({ x: wall.position.x, y: wall.position.y });
    corners.push({ x: wall.position.x + wall.width, y: wall.position.y });
    corners.push({ x: wall.position.x, y: wall.position.y + wall.height });
    corners.push({ x: wall.position.x + wall.width, y: wall.position.y + wall.height });
    
    // Add corners created by destroyed slices
    if (wall.destroyedSlices !== 0 && wall.destroyedSlices !== 0b11111) {
      const sliceDimension = getSliceDimension(wall as any);
      let addedCorners = 0;
      
      // Check each boundary between slices
      for (let i = 0; i <= 5; i++) {
        const adjacentSliceIndices = wall.orientation === 'horizontal' 
          ? { first: i - 1, second: i }  // left/right for horizontal
          : { first: i - 1, second: i }; // top/bottom for vertical
        
        // Get destruction state of adjacent slices
        const firstDestroyed = adjacentSliceIndices.first >= 0 && adjacentSliceIndices.first < 5 
          ? (wall.destroyedSlices >> adjacentSliceIndices.first) & 1 
          : 0;
        const secondDestroyed = adjacentSliceIndices.second >= 0 && adjacentSliceIndices.second < 5 
          ? (wall.destroyedSlices >> adjacentSliceIndices.second) & 1 
          : 0;
        
        // Add corners where destruction state changes
        if (firstDestroyed !== secondDestroyed) {
          const boundaryPos = getSliceBoundaryPosition(wall as any, i);
          
          if (wall.orientation === 'horizontal') {
            // Add both top and bottom corners at this vertical boundary
            corners.push({ x: boundaryPos, y: wall.position.y });
            corners.push({ x: boundaryPos, y: wall.position.y + wall.height });
          } else {
            // Add both left and right corners at this horizontal boundary
            corners.push({ x: wall.position.x, y: boundaryPos });
            corners.push({ x: wall.position.x + wall.width, y: boundaryPos });
          }
          addedCorners += 2;
        }
      }
      
      if (addedCorners > 0) {
        // console.log(`[VisibilityPolygon] Wall ${wall.id} (mask: ${wall.destroyedSlices.toString(2).padStart(5, '0')}) added ${addedCorners} destruction corners`);
      }
    }
    
    return corners;
  }

  /**
   * Check if a corner is exterior (affects visibility) by testing adjacent walls
   */
  private isExteriorCorner(corner: Corner, viewerPos: Vector2): boolean {
    // Count walls touching this corner
    let wallCount = 0;
    const touchingWalls: Wall[] = [];
    
    this.walls.forEach((wall) => {
      if (wall.destroyedSlices === 0b11111) return;
      
      // Check if corner is on wall boundary
      const onLeft = Math.abs(corner.x - wall.position.x) < 0.1;
      const onRight = Math.abs(corner.x - (wall.position.x + wall.width)) < 0.1;
      const onTop = Math.abs(corner.y - wall.position.y) < 0.1;
      const onBottom = Math.abs(corner.y - (wall.position.y + wall.height)) < 0.1;
      
      if ((onLeft || onRight) && (onTop || onBottom)) {
        wallCount++;
        touchingWalls.push(wall);
      }
    });
    
    // Single wall corners are always exterior
    if (wallCount <= 1) return true;
    
    // For corners with 2+ walls, check if it forms a concave angle towards viewer
    if (wallCount === 2) {
      // Calculate if this is an interior corner by checking angles
      const angles: number[] = [];
      
      touchingWalls.forEach((wall) => {
        // Find which edge of the wall contains this corner
        const edges = this.getWallEdgesContainingPoint(wall, corner);
        edges.forEach(edge => {
          const angle = Math.atan2(edge.dy, edge.dx);
          angles.push(angle);
        });
      });
      
      // Sort angles and check if they form interior corner
      angles.sort((a, b) => a - b);
      for (let i = 0; i < angles.length; i++) {
        const nextI = (i + 1) % angles.length;
        let angleDiff = angles[nextI] - angles[i];
        if (angleDiff < 0) angleDiff += 2 * Math.PI;
        
        // If angle difference > PI, this is exterior facing viewer
        if (angleDiff > Math.PI) {
          const midAngle = angles[i] + angleDiff / 2;
          const toViewer = Math.atan2(viewerPos.y - corner.y, viewerPos.x - corner.x);
          let diff = Math.abs(midAngle - toViewer);
          if (diff > Math.PI) diff = 2 * Math.PI - diff;
          
          if (diff < Math.PI / 2) return true;
        }
      }
    }
    
    // Conservative: when in doubt, include the corner
    return wallCount < 4;
  }

  /**
   * Get wall edges that contain a specific point
   */
  private getWallEdgesContainingPoint(wall: Wall, point: Vector2): Array<{dx: number, dy: number}> {
    const edges: Array<{dx: number, dy: number}> = [];
    const epsilon = 0.1;
    
    // Top edge
    if (Math.abs(point.y - wall.position.y) < epsilon &&
        point.x >= wall.position.x - epsilon &&
        point.x <= wall.position.x + wall.width + epsilon) {
      edges.push({ dx: 1, dy: 0 });
    }
    
    // Bottom edge
    if (Math.abs(point.y - (wall.position.y + wall.height)) < epsilon &&
        point.x >= wall.position.x - epsilon &&
        point.x <= wall.position.x + wall.width + epsilon) {
      edges.push({ dx: -1, dy: 0 });
    }
    
    // Left edge
    if (Math.abs(point.x - wall.position.x) < epsilon &&
        point.y >= wall.position.y - epsilon &&
        point.y <= wall.position.y + wall.height + epsilon) {
      edges.push({ dx: 0, dy: -1 });
    }
    
    // Right edge
    if (Math.abs(point.x - (wall.position.x + wall.width)) < epsilon &&
        point.y >= wall.position.y - epsilon &&
        point.y <= wall.position.y + wall.height + epsilon) {
      edges.push({ dx: 0, dy: 1 });
    }
    
    return edges;
  }

  /**
   * Cast a ray from viewer position at given angle
   */
  private castRay(viewerPos: Vector2, angle: number): Vector2 | null {
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    
    let closestIntersection: Vector2 | null = null;
    let closestDistance = this.viewDistance;
    
    // Check intersection with all walls
    this.walls.forEach((wall) => {
      // Skip fully destroyed walls
      if (wall.destroyedSlices === 0b11111) return;
      
      const intersection = this.rayRectIntersection(
        viewerPos,
        { x: dx, y: dy },
        wall.position,
        wall.width,
        wall.height
      );
      
      if (intersection) {
        const dist = Math.hypot(
          intersection.x - viewerPos.x,
          intersection.y - viewerPos.y
        );
        
        if (dist < closestDistance) {
          // Check which slice the ray hits
          const hitSliceIndex = calculateSliceIndex(wall as any, intersection);
          
          // Create a temporary wall object to check material-based visibility
          const tempWall = {
            material: wall.material as 'concrete' | 'wood' | 'metal' | 'glass',
            destructionMask: new Uint8Array(5),
            id: wall.id,
            position: wall.position,
            width: wall.width,
            height: wall.height,
            orientation: wall.orientation,
            maxHealth: wall.maxHealth,
            sliceHealth: wall.sliceHealth
          };
          
          // Check if this slice should block vision based on health
          if (shouldSliceBlockVisionByHealth(tempWall, hitSliceIndex)) {
            // This slice blocks vision - this is our intersection
            closestIntersection = intersection;
            closestDistance = dist;
          } else {
            // This slice doesn't block vision - check for slice boundaries
            // Cast ray through the wall to find where it would exit or hit a blocking slice
            const sliceBoundaryHit = this.checkSliceBoundaries(wall, viewerPos, { x: dx, y: dy }, intersection);
            
            if (sliceBoundaryHit && sliceBoundaryHit.distance < closestDistance) {
              closestIntersection = sliceBoundaryHit.point;
              closestDistance = sliceBoundaryHit.distance;
            }
          }
        }
      }
    });
    
    // If no intersection, ray extends to view distance
    if (!closestIntersection) {
      closestIntersection = {
        x: viewerPos.x + dx * this.viewDistance,
        y: viewerPos.y + dy * this.viewDistance
      };
    }
    
    return closestIntersection;
  }

  /**
   * Ray-rectangle intersection test
   */
  private rayRectIntersection(
    origin: Vector2,
    direction: Vector2,
    rectPos: Vector2,
    width: number,
    height: number
  ): Vector2 | null {
    const tMin = 0;
    const tMax = this.viewDistance;
    
    // Calculate t values for intersection with each edge
    const tx1 = (rectPos.x - origin.x) / direction.x;
    const tx2 = (rectPos.x + width - origin.x) / direction.x;
    const ty1 = (rectPos.y - origin.y) / direction.y;
    const ty2 = (rectPos.y + height - origin.y) / direction.y;
    
    const tMinX = Math.min(tx1, tx2);
    const tMaxX = Math.max(tx1, tx2);
    const tMinY = Math.min(ty1, ty2);
    const tMaxY = Math.max(ty1, ty2);
    
    const tEnter = Math.max(tMinX, tMinY, tMin);
    const tExit = Math.min(tMaxX, tMaxY, tMax);
    
    if (tEnter <= tExit && tEnter >= 0) {
      return {
        x: origin.x + direction.x * tEnter,
        y: origin.y + direction.y * tEnter
      };
    }
    
    return null;
  }

  /**
   * Check for slice boundaries when ray enters through a destroyed slice
   */
  private checkSliceBoundaries(
    wall: Wall,
    rayStart: Vector2,
    rayDir: Vector2,
    entryPoint: Vector2
  ): { point: Vector2; distance: number } | null {
    const sliceDimension = getSliceDimension(wall as any);
    let closestHit: { point: Vector2; distance: number } | null = null;
    
    // Calculate which slice we entered through
    const entrySliceIndex = calculateSliceIndex(wall as any, entryPoint);
    
    // Check all slice boundaries for potential hits
    for (let sliceIndex = 0; sliceIndex <= 5; sliceIndex++) {
      // Check if this boundary is between destroyed and intact slices
      const leftSlice = sliceIndex - 1;
      const rightSlice = sliceIndex;
      
      // Check if slices allow vision based on health
      const leftAllowsVision = leftSlice >= 0 && leftSlice < 5 ? 
        !shouldSliceBlockVisionByHealth(wall as any, leftSlice) : true;
      const rightAllowsVision = rightSlice >= 0 && rightSlice < 5 ? 
        !shouldSliceBlockVisionByHealth(wall as any, rightSlice) : true;
      
      // Skip if both sides are the same (both allow vision or both block)
      if (leftAllowsVision === rightAllowsVision) continue;
      
      // Calculate boundary position
      const boundaryPos = getSliceBoundaryPosition(wall as any, sliceIndex);
      
      // Check if ray intersects this boundary based on wall orientation
      if (wall.orientation === 'horizontal') {
        // Check vertical boundary (constant X)
        if (Math.abs(rayDir.x) > 0.0001) {
          const t = (boundaryPos - entryPoint.x) / rayDir.x;
          
          // Only consider forward intersections
          if (t > 0) {
            const intersectY = entryPoint.y + rayDir.y * t;
            
            // Check if intersection is within wall bounds
            if (intersectY >= wall.position.y && intersectY <= wall.position.y + wall.height) {
              const hitPoint = { x: boundaryPos, y: intersectY };
              const distance = Math.hypot(hitPoint.x - rayStart.x, hitPoint.y - rayStart.y);
              
              // Update closest hit if this is nearer
              if (!closestHit || distance < closestHit.distance) {
                // Only count as hit if we're moving from destroyed to intact
                const movingRight = rayDir.x > 0;
                const hittingBlockingSlice = movingRight ? !rightAllowsVision : !leftAllowsVision;
                
                if (hittingBlockingSlice) {
                  closestHit = { point: hitPoint, distance: distance };
                }
              }
            }
          }
        }
      } else {
        // Vertical wall - check horizontal boundary (constant Y)
        if (Math.abs(rayDir.y) > 0.0001) {
          const t = (boundaryPos - entryPoint.y) / rayDir.y;
          
          // Only consider forward intersections
          if (t > 0) {
            const intersectX = entryPoint.x + rayDir.x * t;
            
            // Check if intersection is within wall bounds
            if (intersectX >= wall.position.x && intersectX <= wall.position.x + wall.width) {
              const hitPoint = { x: intersectX, y: boundaryPos };
              const distance = Math.hypot(hitPoint.x - rayStart.x, hitPoint.y - rayStart.y);
              
              // Update closest hit if this is nearer
              if (!closestHit || distance < closestHit.distance) {
                // Only count as hit if we're moving from destroyed to intact
                const movingDown = rayDir.y > 0;
                const topSlice = sliceIndex - 1;
                const bottomSlice = sliceIndex;
                const hittingBlockingSlice = movingDown ? !rightAllowsVision : !leftAllowsVision;
                
                if (hittingBlockingSlice) {
                  closestHit = { point: hitPoint, distance: distance };
                }
              }
            }
          }
        }
      }
    }
    
    // Also check if ray exits the wall through an intact slice
    // Calculate exit point from wall
    const tExitX = rayDir.x > 0 ? 
      (wall.position.x + wall.width - entryPoint.x) / rayDir.x :
      (wall.position.x - entryPoint.x) / rayDir.x;
    const tExitY = rayDir.y > 0 ?
      (wall.position.y + wall.height - entryPoint.y) / rayDir.y :
      (wall.position.y - entryPoint.y) / rayDir.y;
    
    const tExit = Math.min(Math.abs(tExitX), Math.abs(tExitY));
    
    if (tExit > 0) {
      const exitX = entryPoint.x + rayDir.x * tExit;
      const exitY = entryPoint.y + rayDir.y * tExit;
      
      // Clamp to wall bounds
      const clampedExitX = Math.max(wall.position.x, Math.min(wall.position.x + wall.width, exitX));
      const clampedExitY = Math.max(wall.position.y, Math.min(wall.position.y + wall.height, exitY));
      
      // Check which slice we're exiting through
      const exitSliceIndex = calculateSliceIndex(wall as any, { x: clampedExitX, y: clampedExitY });
      
      const exitSliceBlocksVision = shouldSliceBlockVisionByHealth(wall as any, exitSliceIndex);
      
      if (exitSliceBlocksVision) {
        // Exiting through intact slice
        const hitPoint = { x: clampedExitX, y: clampedExitY };
        const distance = Math.hypot(hitPoint.x - rayStart.x, hitPoint.y - rayStart.y);
        
        if (!closestHit || distance < closestHit.distance) {
          closestHit = { point: hitPoint, distance: distance };
        }
      }
    }
    
    return closestHit;
  }

  /**
   * Find intersection points between an edge and the vision arc
   * Returns 0, 1, or 2 points where the edge crosses the arc
   */
  private findArcEdgeIntersections(edge: { start: Vector2, end: Vector2 }, viewerPos: Vector2, viewDirection: number): Vector2[] {
    const intersections: Vector2[] = [];
    const leftBound = viewDirection - this.viewAngle / 2;
    const rightBound = viewDirection + this.viewAngle / 2;
    
    // Ray-circle intersection for the edge treated as an infinite line
    const dx = edge.end.x - edge.start.x;
    const dy = edge.end.y - edge.start.y;
    const fx = edge.start.x - viewerPos.x;
    const fy = edge.start.y - viewerPos.y;
    
    const a = dx * dx + dy * dy;
    const b = 2 * (fx * dx + fy * dy);
    const c = fx * fx + fy * fy - this.viewDistance * this.viewDistance;
    
    const discriminant = b * b - 4 * a * c;
    if (discriminant < 0) return intersections; // No intersection
    
    const sqrt_discriminant = Math.sqrt(discriminant);
    const t1 = (-b - sqrt_discriminant) / (2 * a);
    const t2 = (-b + sqrt_discriminant) / (2 * a);
    
    // Check each intersection point
    for (const t of [t1, t2]) {
      if (t >= 0 && t <= 1) { // Point is on the line segment
        const x = edge.start.x + t * dx;
        const y = edge.start.y + t * dy;
        
        // Check if point is within the FOV angle
        const angle = Math.atan2(y - viewerPos.y, x - viewerPos.x);
        if (this.isAngleInViewCone(angle, leftBound, rightBound)) {
          intersections.push({ x, y });
        }
      }
    }
    
    return intersections;
  }

  /**
   * Convert visibility polygon to tile visibility for compatibility
   */
  calculateTileVisibility(viewerPos: Vector2, viewDirection: number): boolean[][] {
    const polygon = this.calculateVisibility(viewerPos, viewDirection);
    const tilesX = Math.ceil(GAME_CONFIG.GAME_WIDTH / 8);
    const tilesY = Math.ceil(GAME_CONFIG.GAME_HEIGHT / 8);
    const visibility = Array(tilesY).fill(null).map(() => Array(tilesX).fill(false));
    
    // Rasterize polygon to tiles
    for (let y = 0; y < tilesY; y++) {
      for (let x = 0; x < tilesX; x++) {
        const tileCenter = {
          x: x * 8 + 4,
          y: y * 8 + 4
        };
        
        if (this.pointInPolygon(tileCenter, polygon)) {
          visibility[y][x] = true;
        }
      }
    }
    
    return visibility;
  }

  /**
   * Point-in-polygon test using ray casting
   */
  private pointInPolygon(point: Vector2, polygon: Vector2[]): boolean {
    let inside = false;
    
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].x, yi = polygon[i].y;
      const xj = polygon[j].x, yj = polygon[j].y;
      
      const intersect = ((yi > point.y) !== (yj > point.y))
        && (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
      
      if (intersect) inside = !inside;
    }
    
    return inside;
  }

  /**
   * Remove player (compatibility method)
   */
  removePlayer(playerId: string): void {
    // No player-specific state in polygon system
  }

  /**
   * Get raw visibility polygon (for pixel-perfect rendering)
   * Returns vertices of the visibility polygon in order
   */
  getVisibilityPolygon(viewerPos: Vector2, viewDirection: number): Vector2[] {
    return this.calculateVisibility(viewerPos, viewDirection);
  }

  /**
   * Get visibility data in a compact format for network transmission
   */
  getVisibilityData(player: PlayerState): {
    polygon: Vector2[];
    viewAngle: number;
    viewDirection: number;
    viewDistance: number;
  } {
    const polygon = this.calculateVisibility(
      player.transform.position,
      player.transform.rotation
    );
    
    return {
      polygon,
      viewAngle: this.viewAngle,
      viewDirection: player.transform.rotation,
      viewDistance: this.viewDistance
    };
  }

  /**
   * Update player vision (main method called by GameStateSystem)
   * Returns a Set of visible tile indices for compatibility
   */
  updatePlayerVisionRaycast(player: PlayerState): Set<number> {
    const visibility = this.calculateTileVisibility(
      player.transform.position,
      player.transform.rotation
    );
    
    // Convert 2D boolean array to Set of tile indices
    const visibleTiles = new Set<number>();
    const tilesX = Math.ceil(GAME_CONFIG.GAME_WIDTH / 8);
    
    for (let y = 0; y < visibility.length; y++) {
      for (let x = 0; x < visibility[y].length; x++) {
        if (visibility[y][x]) {
          const tileIndex = y * tilesX + x;
          visibleTiles.add(tileIndex);
        }
      }
    }
    
    return visibleTiles;
  }

  /**
   * Get debug information about the current visibility calculation
   */
  getDebugInfo(viewerPos: Vector2, viewDirection: number): { corners: Corner[], bounds: { left: number, right: number } } {
    const leftBound = viewDirection - this.viewAngle / 2;
    const rightBound = viewDirection + this.viewAngle / 2;
    const corners = this.findVisibleCorners(viewerPos, viewDirection);
    
    return {
      corners: corners,
      bounds: { 
        left: leftBound * 180 / Math.PI, 
        right: rightBound * 180 / Math.PI 
      }
    };
  }
} 