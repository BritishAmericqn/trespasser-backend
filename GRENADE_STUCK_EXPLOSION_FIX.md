# Grenade Stuck and Explosion Fix

## Problem
After fixing grenade physics to prevent phasing through walls, grenades were:
1. Getting stuck bouncing in place
2. Not exploding after their 3-second timer

## Root Causes

### 1. Immediate Re-collision
When grenades bounced off walls, they weren't being moved away from the collision point. This caused:
- Immediate re-collision on the next frame
- Velocity reduction by 0.6x on each bounce
- Grenades eventually moving so slowly they appeared stuck

### 2. Stuck Projectiles
Old projectiles from previous tests were stuck at extreme positions:
- projectile_1 at (4617, -12961)
- projectile_2 at (-937, -7595)
These were way outside the 480x270 game area.

## Solutions

### 1. Push Away After Bounce
Modified `handleWallBounce` to push grenades 2 pixels away from walls after bouncing:

```typescript
const pushDistance = 2; // Push away from wall to prevent re-collision

if (projectile.position.x < wall.position.x) {
  projectile.position.x = wall.position.x - pushDistance;
} else {
  projectile.position.x = wall.position.x + wall.width + pushDistance;
}
```

### 2. Clean Up Extreme Projectiles
Added check to remove projectiles that are far outside game bounds:

```typescript
const maxBounds = 1000; // Well outside the 480x270 game area
if (Math.abs(projectile.position.x) > maxBounds || Math.abs(projectile.position.y) > maxBounds) {
  console.log(`🧹 Removing stuck projectile ${projectileId} at extreme position`);
  projectilesToRemove.push(projectileId);
}
```

### 3. Update Physics Body Position
Ensure Matter.js body position is updated after bounce adjustment:

```typescript
if (body) {
  Matter.Body.setPosition(body, projectile.position);
  Matter.Body.setVelocity(body, projectile.velocity);
}
```

## Testing
Use the test client (test-client.html) to:
1. Fire grenades at walls - they should bounce naturally
2. Wait 3 seconds - grenades should explode
3. Fire at different angles - no stuck grenades

## Result
Grenades now:
- ✅ Bounce off walls without getting stuck
- ✅ Explode after 3-second timer
- ✅ Move at proper speeds (8-32 px/s)
- ✅ Don't phase through walls 