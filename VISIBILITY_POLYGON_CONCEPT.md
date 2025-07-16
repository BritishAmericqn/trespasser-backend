# Visibility Polygon Algorithm Concept

## The Core Insight

Your observation is spot-on! Since walls are static and we placed them ourselves, we can use their geometry to create perfect sight lines. Here's how:

## Algorithm Overview

```
1. Find all wall corners within potential view range
2. Cast rays from player to each corner
3. Sort corners by angle
4. Create visibility polygon by connecting visible points
5. Everything inside polygon is visible
```

## Visual Example

```
Legend: @ = Player, # = Wall, * = Corner, . = Visible, ~ = Shadow

Before:                          After (with visibility polygon):
#########                        #########
#.......#                        #*-----*#  <- Corners create boundary
#...@...# ####                   #.\.@./.# ####
#.......###..#                   #..\./.*##*~#  <- Shadow beyond corner
#........*...#                   #...*.....~~#
##############                   ##############

The * corners are key points where vision boundaries change
```

## Why This Works Better Than Tile Raycasting

### Current Tile-Based System:
- Casts 60 rays across 120° cone
- Checks intersection with every 8×8 tile
- O(rays × tiles) complexity
- Approximation errors at edges

### Visibility Polygon System:
- Cast rays only to wall corners (~10-50 points typically)
- Sort by angle once
- O(corners × log(corners)) complexity
- Geometrically perfect results

## Implementation Approach

### 1. Corner Detection
```typescript
interface Corner {
  x: number;
  y: number;
  angle: number; // angle from player
  distance: number;
  wallId: string;
}

function findVisibleCorners(player: Vector2, walls: Wall[]): Corner[] {
  const corners: Corner[] = [];
  
  for (const wall of walls) {
    // Get all 4 corners of the wall
    const wallCorners = [
      {x: wall.x, y: wall.y},
      {x: wall.x + wall.width, y: wall.y},
      {x: wall.x, y: wall.y + wall.height},
      {x: wall.x + wall.width, y: wall.y + wall.height}
    ];
    
    for (const corner of wallCorners) {
      const angle = Math.atan2(corner.y - player.y, corner.x - player.x);
      const distance = Math.hypot(corner.x - player.x, corner.y - player.y);
      
      if (distance <= viewRange) {
        corners.push({...corner, angle, distance, wallId: wall.id});
      }
    }
  }
  
  return corners;
}
```

### 2. Ray Casting to Corners
```typescript
function castRayToCorner(player: Vector2, corner: Corner, walls: Wall[]): Vector2 | null {
  // Cast ray from player to corner
  // Check if any wall blocks it
  let closestIntersection = corner;
  let closestDistance = corner.distance;
  
  for (const wall of walls) {
    const intersection = rayWallIntersection(player, corner, wall);
    if (intersection) {
      const dist = Math.hypot(intersection.x - player.x, intersection.y - player.y);
      if (dist < closestDistance) {
        closestIntersection = intersection;
        closestDistance = dist;
      }
    }
  }
  
  return closestIntersection;
}
```

### 3. Building the Visibility Polygon
```typescript
function buildVisibilityPolygon(player: Vector2, walls: Wall[]): Vector2[] {
  const corners = findVisibleCorners(player, walls);
  
  // Sort by angle
  corners.sort((a, b) => a.angle - b.angle);
  
  const visibilityPoints: Vector2[] = [];
  
  for (const corner of corners) {
    // Cast ray slightly before and after corner (to handle edges)
    const epsilon = 0.00001;
    
    const before = castRayToCorner(player, {
      ...corner,
      angle: corner.angle - epsilon
    }, walls);
    
    const after = castRayToCorner(player, {
      ...corner,
      angle: corner.angle + epsilon
    }, walls);
    
    if (before) visibilityPoints.push(before);
    if (after) visibilityPoints.push(after);
  }
  
  return visibilityPoints;
}
```

## Benefits for Your Game

1. **Sharp, Clean Lines**: Perfect geometric precision
2. **Better Performance**: Fewer calculations at low resolutions
3. **No Tile Artifacts**: No 8×8 approximation errors
4. **Natural Shadows**: Corners automatically create proper shadows
5. **Slice-Aware Compatible**: Can still respect your 5-slice wall system

## Edge Cases to Handle

1. **Player Inside Wall**: Skip that wall's corners
2. **Overlapping Corners**: Deduplicate by position
3. **Vision Cone**: Only process corners within 120° arc
4. **Maximum Range**: Pre-filter corners beyond vision distance

## Performance Considerations

At 480×270 with typical wall layouts:
- ~20-100 wall corners in range
- ~40-200 rays (with epsilon offsets)
- Still well within performance budget
- Can cache static wall corners

## References

The search results show this is a proven technique:
- Red Blob Games has an excellent interactive demo
- Used in many roguelikes and strategy games
- Sometimes called "2D shadow casting" or "visibility polygons"

Would you like me to implement this algorithm to test it in your game? 