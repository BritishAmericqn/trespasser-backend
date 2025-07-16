# Vision System Optimization: Lessons Learned

## ❌ What Went Wrong with Edge-Perfect Vision

The EdgePerfectVisionSystem caused the server to consume **88.9% CPU** and become unresponsive. This was due to:

1. **Too Many Calculations per Frame**
   - 8 players × 60 rays × every wall rectangle = thousands of Liang-Barsky calculations
   - Running at 60Hz meant millions of calculations per second
   - No caching or optimization

2. **Unnecessary Precision**
   - At 480×270 resolution, pixel-perfect precision is overkill
   - The 8×8 tile system is already quite precise for this resolution
   - Complex math for minimal visual improvement

3. **Poor Integration**
   - Wrapper pattern added overhead
   - Converting between tile and edge systems repeatedly
   - No spatial partitioning to limit calculations

## ✅ Better Approach: Optimized Tile Vision

Instead of replacing the tile system, we should **enhance** it:

### 1. **Smooth Tile Edges** (Low Cost, High Impact)
```typescript
// Anti-alias tile boundaries by checking partial coverage
const coverage = calculateTileCoverage(ray, tile);
if (coverage > 0.1 && coverage < 0.9) {
  // Partial visibility for smoother edges
  visibility *= coverage;
}
```

### 2. **Corner Visibility** (Prevent Hiding)
```typescript
// Check corners of player bounding box, not just center
const corners = [
  {x: player.x - 5, y: player.y - 5},
  {x: player.x + 5, y: player.y - 5},
  {x: player.x - 5, y: player.y + 5},
  {x: player.x + 5, y: player.y + 5}
];
// Player visible if ANY corner is visible
```

### 3. **Smart Ray Distribution**
```typescript
// More rays in movement direction
const baseRays = 40;
const focusRays = 20;
// Distribute focus rays ±30° around look direction
```

### 4. **Incremental Updates**
```typescript
// Only recalculate changed sectors
if (playerMovedSignificantly || wallsChanged) {
  updateSector(player.currentSector);
  // Keep other sectors cached
}
```

## 🎯 Implementation Priority

1. **Fix Current Issues First**
   - Ensure slice-aware vision works perfectly
   - Test with 8 players for performance baseline
   
2. **Add Corner Visibility**
   - Simple 4-corner check
   - Prevents wall-hugging exploits
   - Minimal performance impact

3. **Smooth Edges (Optional)**
   - Only if performance allows
   - Use simple coverage calculation
   - May not be needed at 480×270

## 📊 Performance Budget

At 480×270 with 8 players:
- Current: ~1-3ms (good!)
- Target: Stay under 5ms
- Available headroom: 2-4ms

Use this headroom wisely:
- Corner checks: +0.5ms
- Edge smoothing: +1ms  
- Smart rays: +0.5ms

## 🚫 What NOT to Do

- Don't replace the tile system
- Don't add complex geometric calculations
- Don't calculate every frame
- Don't trust "perfect" solutions that ignore performance

## 💡 Key Insight

At 480×270 resolution, an 8×8 tile is already very small (3% of screen width). The visual difference between tile-based and pixel-perfect vision is minimal, but the performance difference is massive.

Work WITH the tile system, not against it. 