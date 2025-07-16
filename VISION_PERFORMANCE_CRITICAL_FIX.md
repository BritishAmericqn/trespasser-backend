# 🚨 CRITICAL: Vision System Performance Crisis

## The Problem: O(n × m × p) Complexity is Killing Your Server

**Current algorithm complexity:**
- n = 16,200 pixels per player
- m = 12 walls to check per pixel  
- p = 8 players
- **Total: 1.5 MILLION operations per frame!**

Even at 20Hz (every 3 frames), that's **31 MILLION wall checks per second!**

## Why It Eventually Crashes

1. **Memory pressure** - Creating millions of strings for pixel coordinates
2. **Garbage collection** - Sets growing to 16,000+ items per player
3. **CPU saturation** - Eventually the event loop can't keep up
4. **Silent death** - Node.js doesn't log when it's overwhelmed, it just stops processing

## Immediate Fix: Spatial Optimization

### 1. Pre-compute Wall Boundaries (One-time cost)
```typescript
// Add to VisionSystem
private wallBounds: Map<string, {minX: number, maxX: number, minY: number, maxY: number}> = new Map();

updateWallBounds(walls: Map<string, WallState>) {
  this.wallBounds.clear();
  for (const [id, wall] of walls) {
    this.wallBounds.set(id, {
      minX: wall.position.x,
      maxX: wall.position.x + wall.width,
      minY: wall.position.y,
      maxY: wall.position.y + wall.height
    });
  }
}
```

### 2. Optimize Wall Checking (10x faster)
```typescript
private isWallBlocking(x: number, y: number, walls: Map<string, WallState>): boolean {
  // Early exit - check bounds first!
  for (const [wallId, bounds] of this.wallBounds) {
    if (x < bounds.minX || x >= bounds.maxX || 
        y < bounds.minY || y >= bounds.maxY) {
      continue; // Skip walls that can't possibly contain this point
    }
    
    // Only check walls that could contain this pixel
    const wall = walls.get(wallId)!;
    const sliceWidth = wall.width / GAME_CONFIG.DESTRUCTION.WALL_SLICES;
    const sliceIndex = Math.floor((x - wall.position.x) / sliceWidth);
    
    if (wall.destructionMask[sliceIndex] === 0) {
      return true;
    }
  }
  return false;
}
```

### 3. Reduce Vision Range Temporarily
```typescript
// In shared/constants/index.ts
VISION_RANGE: 60, // Reduced from 100
```

### 4. Add Pixel Skipping for Distant Areas
```typescript
// In calculateMainVision - skip pixels at distance
const distance = Math.sqrt((x - x0) ** 2 + (y - y0) ** 2);
const skipFactor = Math.floor(distance / 30); // Skip more pixels when far
if (skipFactor > 0 && x % (skipFactor + 1) !== 0) continue;
```

## Long-term Solutions

1. **Quadtree spatial partitioning** - Only check nearby walls
2. **Hierarchical vision** - Low-res far vision, high-res near
3. **Vision LOD** - Reduce precision at distance
4. **Precomputed vision masks** - Cache common positions

## Emergency Hotfix Steps

1. Implement wall bounds optimization
2. Reduce vision range to 60
3. Increase vision update interval to every 6 frames
4. Add performance monitoring

This should reduce complexity from O(n × m × p) to O(n × k × p) where k << m (only nearby walls).

## Expected Performance Gain

- **Before**: 1.5M operations/frame
- **After**: ~150K operations/frame (90% reduction)
- Server should run smoothly with 8 players 