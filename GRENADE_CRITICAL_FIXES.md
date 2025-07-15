# Critical Grenade Fixes

## Issues Reported
1. **Grid Line Collision**: Grenades interacting with coordinate grid lines
2. **Wall Sliding**: Grenades sliding along walls instead of bouncing
3. **No Explosions**: 3-second timer not working
4. **Infinite Grenades**: Grenades never removed from game

## Root Causes Identified

### 1. Grid Line Collision
**Problem**: Frontend rendering coordinate grid lines as collidable objects
**Backend Status**: No grid walls exist in backend - only 12 walls (8 game + 4 boundaries)
**Solution**: This is a FRONTEND issue - grid lines should be visual only

### 2. Timer Check Skipped
**Problem**: `continue projectileLoop` after bounce prevented timer check
```typescript
// BEFORE: This skipped all remaining checks!
console.log(`🎾 Grenade bounced off wall!`);
continue projectileLoop; // ❌ Skips timer check!
```
**Solution**: Removed continue statement to allow timer checks

### 3. Poor Bounce Physics
**Problem**: Simple velocity reversal caused sliding along walls
**Solution**: Implemented proper collision normal calculation:
- Find closest point on wall
- Calculate reflection vector
- Push grenade away from wall

### 4. Collision Spam
**Problem**: Grenades colliding with same wall every frame
**Solution**: Added collision cooldown (100ms) per wall

## Code Changes Applied

### 1. Fixed Timer Check
```typescript
// projectile collision handling
} else if (projectile.type === 'grenade') {
  this.handleWallBounce(projectile, wallCollision.wall!);
  // Don't continue - we need to check timer
}
// Timer check now runs after collision!
```

### 2. Improved Bounce Physics
```typescript
// Calculate proper collision normal
const closestX = Math.max(wallLeft, Math.min(projectile.position.x, wallRight));
const closestY = Math.max(wallTop, Math.min(projectile.position.y, wallBottom));

let normalX = projectile.position.x - closestX;
let normalY = projectile.position.y - closestY;

// Reflect velocity properly
const dotProduct = projectile.velocity.x * normalX + projectile.velocity.y * normalY;
projectile.velocity.x = (projectile.velocity.x - 2 * dotProduct * normalX) * bounceFactor;
```

### 3. Collision Cooldown
```typescript
// Track recent collisions
private recentCollisions: Map<string, Map<string, number>> = new Map();

// Skip if we collided with this wall recently
if (now - lastCollisionTime < 100) {
  continue;
}
```

## Frontend Action Required

### 1. Remove Grid Collision
The coordinate grid lines should be rendered but NOT treated as collision objects:
```typescript
// Frontend grid rendering
renderGrid() {
  // Draw grid lines
  this.graphics.lineStyle(1, 0x00ff00, 0.3);
  // ... draw lines ...
  
  // DO NOT add collision bodies for grid!
}
```

### 2. Debug Wall List
Frontend should verify it only has these walls:
- wall_1 through wall_8 (game walls)
- wall_9 through wall_12 (boundaries)
- NO grid line walls

### 3. Test Grenades
After fixes:
1. Grenades should bounce naturally off walls
2. Explode after exactly 3 seconds
3. Not slide along walls
4. Not interact with grid lines

## Testing Commands
```bash
# Test grenade at max charge (should travel ~160 pixels before exploding)
socket.emit('weapon:fire', {
  weaponType: 'grenade',
  angle: 0,
  chargeLevel: 5,
  position: { x: 240, y: 135 },
  timestamp: Date.now()
});
```

## Expected Behavior
- Grenade speed: 8-32 px/s (based on charge 1-5)
- Bounce factor: 0.6x velocity reduction
- Explosion time: 3000ms
- Explosion radius: 40 pixels 