# Grenade System Final Fix

## Critical Issues Fixed

### 1. **Grenades Not Exploding**
**Problem**: Grenades were getting stuck in collision loops and never reaching the 3-second timer check.

**Solution**: 
- Moved timer check BEFORE collision detection
- Added minimum velocity check (< 0.1 px/s triggers explosion)
- Cleaned up old stuck projectiles at extreme positions

### 2. **Collision Grid Interference**
**Problem**: Frontend was rendering coordinate grid lines as collidable objects.

**Status**: This is a FRONTEND issue - backend only has 12 walls (8 game + 4 boundaries).

### 3. **Wall Sliding Behavior**
**Problem**: Grenades would slide along walls after collision due to insufficient separation.

**Solution**:
- Increased push distance from 2 to 5 pixels after bounce
- Added boundary clamping to keep grenades in play area
- Improved collision normal calculation

## Implementation Details

### Timer Priority
```typescript
// Timer check happens FIRST (before collision checks)
if (projectile.type === 'grenade') {
  const fuseTime = 3000; // 3 seconds
  const timeAlive = Date.now() - projectile.timestamp;
  if (timeAlive >= fuseTime) {
    // Explode grenade
  }
}
```

### Stuck Detection
```typescript
// Remove grenades moving too slowly
const velocityMagnitude = Math.sqrt(velocity.x ** 2 + velocity.y ** 2);
if (velocityMagnitude < 0.1) { // Less than 0.1 px/s
  // Explode stuck grenade
}
```

### Cleanup Logic
```typescript
// Remove projectiles far outside game area
const maxBounds = 1000; // Game area is 480x270
if (Math.abs(position.x) > maxBounds || Math.abs(position.y) > maxBounds) {
  // Remove stuck projectile
}
```

## Testing

Use `test-grenade-cleanup.js` to verify:
```bash
node test-grenade-cleanup.js
```

Expected behavior:
1. Grenades bounce off walls with proper physics
2. Grenades explode after 3 seconds OR when stuck
3. No projectiles accumulate at extreme positions
4. Collision cooldown prevents bounce loops

## Key Parameters
- **Fuse Time**: 3000ms (3 seconds)
- **Minimum Velocity**: 0.1 px/s (below this = stuck)
- **Bounce Factor**: 0.6 (velocity reduction per bounce)
- **Push Distance**: 5 pixels (separation from walls)
- **Collision Cooldown**: 100ms (prevent same-wall re-collision)

## Known Issues
- Frontend grid lines need to be visual-only (not collidable)
- Matter.js physics bodies may still interfere with manual collision 