# Physics-Based Grenade Collision Solution

## Current Issues

1. **Infinite Collision Loop**: Grenades get stuck in repeated collision detection with walls
2. **Position at 20040**: Grenades stuck far off-screen indicate physics corruption
3. **Manual vs Physics Conflict**: Manual collision detection conflicts with Matter.js physics

## Implemented Solution

### 1. Wall Physics Bodies
- Added Matter.js physics bodies to all walls in `DestructionSystem`
- Created boundary walls at screen edges as physics bodies
- Walls are static bodies with proper friction and restitution

### 2. Removed Manual Collision Detection
- Removed manual grenade-wall collision checking in `ProjectileSystem.update()`
- Grenades now skip the manual collision detection loop
- Matter.js handles all grenade physics and collisions

### 3. Physics Event System
- Added collision event handling to `PhysicsSystem`
- Grenades register collision callbacks when created
- Callbacks unregistered when grenades are removed

## Architecture

```
Grenade Creation
    ↓
Matter.js Body Created (circle with radius 2)
    ↓
Physics Engine Updates Position
    ↓
Collision Detection (automatic)
    ↓
Physics Response (bounce, friction)
    ↓
Position Sync to GameState
```

## Key Changes

### DestructionSystem.ts
```typescript
// Walls now create physics bodies
if (this.physics) {
  const body = Matter.Bodies.rectangle(
    position.x + width / 2,
    position.y + height / 2,
    width,
    height,
    {
      isStatic: true,
      friction: 0.8,
      restitution: 0.5,
      label: `wall:${wallId}`
    }
  );
  this.physics.addBody(body);
}
```

### PhysicsSystem.ts
```typescript
// Collision event handling
Matter.Events.on(this.engine, 'collisionStart', (event) => {
  this.handleCollisionStart(event);
});
```

### ProjectileSystem.ts
```typescript
// Skip manual collision for grenades
if (projectile.type === 'grenade') {
  continue; // Let Matter.js handle it
}
```

## Benefits

1. **Realistic Physics**: Proper bouncing, friction, and angular momentum
2. **No Stuck Grenades**: Physics engine prevents penetration
3. **Better Performance**: No redundant collision checks
4. **Cleaner Code**: Separation of concerns between game logic and physics

## Remaining Issues to Fix

1. **Velocity Calculation**: Grenades still using old speed values (200 px/s instead of 8-32 px/s)
2. **Event Routing**: Check if grenades are being fired through correct event handler
3. **Server State**: Clear stuck projectiles on server restart

## Testing

After implementing this solution:
1. Restart the server to clear stuck projectiles
2. Test grenade throws at walls
3. Verify bouncing behavior
4. Check that grenades use correct slow velocities

## Next Steps

1. Fix the velocity issue in `handleGrenadeThrow` method
2. Add debug visualization for physics bodies (optional)
3. Consider adding ground friction for rolling grenades
4. Implement grenade spin/rotation visualization on frontend 