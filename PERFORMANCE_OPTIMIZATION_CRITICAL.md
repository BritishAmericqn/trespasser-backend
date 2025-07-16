# 🚨 CRITICAL PERFORMANCE OPTIMIZATIONS

## Major Performance Issues Found

### 1. **ProjectileSystem Running Every Frame** (60Hz)
Even with NO projectiles, the system still runs and processes walls!

**FIX**: Add early exit:
```typescript
// src/systems/ProjectileSystem.ts - update()
update(deltaTime: number, walls?: Map<string, WallState>) {
  // CRITICAL: Skip everything if no projectiles
  if (this.projectiles.size === 0) {
    return { updateEvents: [], explodeEvents: [] };
  }
  // ... rest of update
}
```

### 2. **Excessive Console Logging**
Console.log is EXTREMELY expensive in browsers!

**FIX**: Comment out ALL non-critical logs:
- Wall collision logs
- Position check logs
- Vision update logs  
- Input processing logs

### 3. **Vision System Still Too Frequent**
Even at 20Hz, calculating vision for 8 players is expensive.

**FIX**: Only update vision when needed:
```typescript
// Only update if player moved significantly OR walls changed
const needsVisionUpdate = 
  posDiff > 5 || 
  rotDiff > 0.174 || 
  this.wallsUpdatedThisTick;
```

### 4. **Wall Iteration in Hot Paths**
Iterating through all walls multiple times per frame.

**FIX**: Cache wall data and use spatial indexing:
```typescript
// Group walls by region for faster lookups
private wallGrid: Map<string, WallState[]> = new Map();
```

## Immediate Actions

### 1. Add Early Exit to ProjectileSystem
```typescript
// src/systems/ProjectileSystem.ts
update(deltaTime: number, walls?: Map<string, WallState>) {
  if (this.projectiles.size === 0) {
    return { updateEvents: [], explodeEvents: [] };
  }
  // ... existing code
}
```

### 2. Disable ALL Console Logs
```typescript
// Create a debug flag
const DEBUG_MODE = false;

// Wrap all logs
if (DEBUG_MODE) {
  console.log(...);
}
```

### 3. Reduce Update Frequencies
- Vision: Only on movement/rotation/wall change
- Projectiles: Only when projectiles exist
- Network: Keep at 20Hz but optimize payload

## Why Games Like Among Us Work

Among Us optimizes by:
1. **Minimal physics** - No complex collision detection
2. **Simple vision** - Binary visible/not visible
3. **Low update rate** - 10-15Hz is enough
4. **Efficient protocols** - Custom binary, not JSON
5. **No console logging** in production

## Expected Results

These optimizations should:
- Reduce CPU usage by 50-70%
- Eliminate frame drops
- Make the game playable on any device

## The Mystery Log

The "🧱 Walls available for collision" log appears to be from compiled JS that wasn't rebuilt properly. Run:
```bash
rm -rf dist/
npm run build
``` 