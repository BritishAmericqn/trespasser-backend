# 🎯 Vision System Performance Optimizations

## Performance Issues Fixed

The server was calculating vision too frequently, causing performance problems. We've applied three optimizations:

### 1. **Reduced Vision Update Frequency**
- **Before**: Vision calculated every frame (60Hz)
- **After**: Vision calculated every 3 frames (20Hz)
- **Exception**: Immediate update when walls are destroyed

```typescript
// Only update vision every 3 frames
this.visionUpdateCounter++;
if (this.visionUpdateCounter >= 3 || this.wallsUpdatedThisTick) {
  // Calculate vision...
}
```

### 2. **Relaxed Cache Invalidation Thresholds**
- **Movement threshold**: 2px → 5px (less sensitive)
- **Rotation threshold**: 5° → 10° (less sensitive)
- **Cache duration**: 100ms → 200ms (longer caching)

### 3. **Existing Optimizations (Already Present)**
- Scanline algorithm with bit-packed visibility
- Vision caching per player
- Debug logging only 5% of the time

## Expected Performance Improvements

- **Vision calculations**: ~20x per second → ~6-7x per second per player
- **CPU usage**: Should drop significantly
- **Network traffic**: Unchanged (still 20Hz broadcasts)

## Vision System Behavior

The vision system now:
1. Updates at most every 50ms (20Hz) during normal movement
2. Updates immediately when walls are destroyed
3. Caches results for up to 200ms if player barely moves
4. Only recalculates when player moves >5 pixels or rotates >10°

## Frontend Requirements

**CRITICAL**: The frontend MUST use the backend's vision data!

```javascript
// Backend sends this every 50ms:
{
  vision: {
    visiblePixels: ["x,y", "x,y", ...], // Array of visible pixel coordinates
    viewAngle: number,
    position: { x, y }
  }
}
```

The frontend should:
1. Use ONLY the `visiblePixels` array for fog rendering
2. NOT calculate its own vision cone
3. NOT draw vision circles/cones larger than ~100px radius 