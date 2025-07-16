# Vision System Improvement Options

## Current State
- **Raycasting**: 60 rays across 120° cone
- **Tile-based**: 8×8 pixel tiles (60×34 grid)
- **Slice-aware**: Vision only passes through destroyed wall slices
- **Performance**: ~1-3ms for 8 players

## Potential Improvements

### 1. 🎯 Smooth Edge Anti-Aliasing (Low Cost)
**Concept**: Soften harsh tile boundaries at vision edges
```typescript
// For edge tiles, calculate partial visibility
const distanceFromCenter = Math.sqrt(dx*dx + dy*dy);
const fadeStart = MAX_VISION_TILES - 3;
if (distanceFromCenter > fadeStart) {
  const opacity = 1 - ((distanceFromCenter - fadeStart) / 3);
  // Send opacity value to frontend for smooth edges
}
```
- **Performance**: +0.5ms (only processes edge tiles)
- **Visual**: Much smoother fog edges
- **Implementation**: 1-2 hours

### 2. 🌟 Dynamic Ray Count (Adaptive Quality)
**Concept**: More rays when stationary, fewer when moving
```typescript
const rayCount = player.isMoving ? 30 : 90;
const qualityMode = player.velocity < 10 ? 'high' : 'low';
```
- **Performance**: 0-2ms (adaptive)
- **Visual**: Higher quality when it matters
- **Implementation**: 2-3 hours

### 3. 🔦 Flashlight Mode (Directional Focus)
**Concept**: Concentrate rays in mouse direction
```typescript
// 50% of rays in ±30° of mouse direction
// 50% spread across remaining FOV
const focusedRays = totalRays * 0.5;
const spreadRays = totalRays * 0.5;
```
- **Performance**: Same as current (just redistributed)
- **Visual**: Better long-range visibility
- **Gameplay**: Rewards precise aiming

### 4. 📐 Sub-Tile Precision (Medium Cost)
**Concept**: 4×4 sub-tiles for critical areas only
```typescript
// Only subdivide tiles that:
// 1. Contain walls
// 2. Are at vision edges
// 3. Have partial destruction
if (needsPrecision(tile)) {
  checkSubTiles(tile, 4); // 16 checks instead of 1
}
```
- **Performance**: +2-4ms
- **Visual**: Smoother wall edges, better gaps
- **Implementation**: 4-5 hours

### 5. 🌊 Vision Caching with Interpolation
**Concept**: Cache and interpolate between updates
```typescript
// Update vision every 100ms (10Hz)
// Interpolate on frontend at 60fps
const oldVision = cache.get(playerId);
const newVision = calculateVision(player);
// Send only differences
const delta = visionDiff(oldVision, newVision);
```
- **Performance**: Major reduction (10Hz vs 20Hz)
- **Network**: 50% less data
- **Visual**: Smooth with interpolation

### 6. 💡 Light Sources & Shadow Casting
**Concept**: Add point lights that cast shadows
```typescript
// Each light source casts shadows
// Reuse raycasting logic
lights.forEach(light => {
  const lightVision = castRaysFrom(light.position, 360);
  combineWithPlayerVision(lightVision);
});
```
- **Performance**: +1-2ms per light
- **Visual**: Dramatic atmosphere
- **Gameplay**: Tactical light placement

### 7. 🎨 Distance-Based LOD
**Concept**: Less precision at distance
```typescript
// Near: Check every tile
// Medium: Check every 2nd tile  
// Far: Check every 4th tile
const lodLevel = distance < 30 ? 1 : distance < 60 ? 2 : 4;
```
- **Performance**: 30-50% reduction
- **Visual**: Unnoticeable at distance
- **Implementation**: 2-3 hours

## Recommended Combination

### "Best Bang for Buck" Package:
1. **Smooth Edge Anti-Aliasing** ✅
2. **Dynamic Ray Count** ✅
3. **Distance-Based LOD** ✅

**Total Performance Impact**: Neutral or better
**Visual Improvement**: Significant
**Implementation Time**: 1 day

### "Premium" Package:
All of the above plus:
4. **Sub-Tile Precision** 
5. **Flashlight Mode**
6. **Light Sources** (2-3 lights max)

**Total Performance Impact**: +3-5ms
**Visual Improvement**: Exceptional
**Implementation Time**: 3-4 days

## Performance Guidelines

### Current Budget
- Vision: 1-3ms
- Physics: 5-10ms  
- Networking: 2-5ms
- **Total frame time**: ~16ms (60fps)

### Available Headroom
At 480×270 with 8 players, you have ~5-8ms to spare.

### Optimization Tricks
1. **Pre-calculate angles**: Store sin/cos lookup tables
2. **Bitwise operations**: Use for tile flags
3. **Object pooling**: Reuse ray result arrays
4. **SIMD.js**: For batch calculations (if available)

## Next Steps
1. Pick a package (recommend "Best Bang for Buck")
2. Implement incrementally
3. Profile each addition
4. Adjust quality dynamically based on performance 