# 🚨 EMERGENCY FIX: Vision System Disabled

## The Problem

The pixel-perfect vision system was fundamentally flawed:
- Calculating 3,600+ pixels per player
- Creating string objects for EVERY pixel: `"x,y"`
- 28,800 string allocations × 10 times/second = **288,000 strings/second**
- This caused garbage collection storms and event loop blocking

## Emergency Fix Applied

1. **Completely disabled vision calculations** in `GameStateSystem.ts`
2. **All players can see all other players** (no fog of war)
3. **All projectiles are visible to everyone**
4. **No vision data sent to frontend**

## Why This Works

- Server no longer creates millions of strings
- No complex scanline algorithms blocking the event loop
- Game remains playable without fog of war
- Server should be stable now

## What's Next: Proper Vision System

### Option 1: Tile-Based Vision (Recommended)
```typescript
// Instead of 129,600 pixels, use 30x17 tiles (510 total)
const TILE_SIZE = 16;
const tilesWide = Math.ceil(480 / TILE_SIZE); // 30
const tilesHigh = Math.ceil(270 / TILE_SIZE); // 17
```

### Option 2: Simple Radius + Raycasts
```typescript
// Only check line-of-sight to specific targets
const canSeePlayer = (viewer: Player, target: Player) => {
  const distance = getDistance(viewer, target);
  if (distance > VISION_RANGE) return false;
  return !hasWallBetween(viewer, target);
};
```

### Option 3: Angle-Based Vision
```typescript
// Store visible angle ranges, not pixels
interface VisionCone {
  startAngle: number;
  endAngle: number;
  blockedRanges: Array<[number, number]>;
}
```

## Testing

The server should now:
- ✅ Run without crashes
- ✅ Handle 8 players smoothly  
- ✅ No slideshow effect
- ❌ No fog of war (temporarily)

## Important Note

This is a **temporary fix**. The game is now essentially "wallhacks enabled" for all players. But at least it won't crash! 