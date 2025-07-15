# Comprehensive Grenade Physics Fix

## Issues Identified

1. **Stuck Projectiles**: Projectiles at extreme positions (x=4617, y=-12961)
2. **Phasing Through Walls**: Grenades passing through walls instead of bouncing
3. **Speed Concerns**: Grenades moving too fast for 480x270 pixel game area

## Root Cause Analysis

### 1. Physics Body Creation
- Grenades DO have Matter.js bodies (radius: 2px)
- Walls DO have Matter.js bodies (static, with proper friction/restitution)
- Physics engine runs at 60Hz correctly

### 2. The REAL Issue: Velocity Scale
The problem is that our velocity values (8-32 px/s) are too slow for Matter.js default settings!

Matter.js has internal velocity limits and minimum speeds for collision detection. When velocities are too low:
- Collision detection may fail
- Bodies may "tunnel" through walls
- Movement appears jerky or stuck

## Solution: Scale Up Physics

### Option 1: Increase Grenade Speeds (RECOMMENDED)
```typescript
// Instead of 8-32 px/s, use 80-320 px/s
GRENADE: {
  BASE_THROW_SPEED: 20,    // was 2
  CHARGE_SPEED_BONUS: 60,  // was 6
  // Results in 80-320 px/s range
}
```

### Option 2: Adjust Physics Engine Settings
```javascript
// In PhysicsSystem constructor
this.engine = Matter.Engine.create();
this.engine.positionIterations = 10;  // Increase from default 6
this.engine.velocityIterations = 10;  // Increase from default 4
this.engine.constraintIterations = 4; // Increase from default 2
```

### Option 3: Fix Collision Detection Explicitly
```javascript
// Enable continuous collision detection for grenades
body = Matter.Bodies.circle(x, y, radius, {
  friction: 0.3,
  frictionAir: 0.01,
  restitution: 0.6,
  label: `grenade:${projectile.id}`,
  render: { visible: false },
  // Add CCD settings
  plugin: {
    attractors: [],
    wrap: null
  },
  // Ensure proper collision filtering
  collisionFilter: {
    group: 0,
    category: 0x0002,
    mask: 0xFFFF
  }
});
```

## Implementation Steps

1. **Clear Stuck Projectiles**
   ```bash
   node clear-projectiles.js
   ```

2. **Update Constants**
   - Increase grenade speeds by 10x
   - This matches typical Matter.js velocity scales

3. **Improve Collision Detection**
   - Increase position iterations
   - Add collision categories
   - Ensure walls have proper collision masks

4. **Test Thoroughly**
   - Verify grenades bounce properly
   - Check they don't phase through walls
   - Confirm speed feels right (80-320 px/s)

## Why This Happens

Matter.js is optimized for typical physics simulations where:
- Velocities are in the 50-500 units/second range
- Bodies are 10-100 units in size
- Time steps are 16.67ms (60Hz)

Our original grenade speeds (8-32 px/s) are too slow for reliable collision detection at 60Hz. Each frame, a grenade only moves 0.13-0.53 pixels, which is below Matter.js's internal thresholds.

## Final Fix Applied

### 1. **Restored Original Speeds** (8-32 px/s)
```typescript
// shared/constants/index.ts
GRENADE: {
  BASE_THROW_SPEED: 2,     // Base speed
  CHARGE_SPEED_BONUS: 6,   // Speed per charge level
  // Speeds: 8, 14, 20, 26, 32 px/s for charges 1-5
}
```

### 2. **Fixed Collision Detection**
```typescript
// src/systems/ProjectileSystem.ts
// Removed skip for grenade collision detection
// Added proper wall bounce handling for grenades
if (projectile.type === 'grenade') {
  this.handleWallBounce(projectile, wallCollision.wall!);
  if (body) {
    Matter.Body.setPosition(body, projectile.position);
    Matter.Body.setVelocity(body, projectile.velocity);
  }
}
```

### 3. **Improved Physics Engine Settings**
```typescript
// src/systems/PhysicsSystem.ts
this.engine.positionIterations = 20;  // Increased for slow objects
this.engine.velocityIterations = 20;  // Increased for slow objects
this.engine.constraintIterations = 10; // Increased for slow objects
```

### 4. **Result**
- Grenades move at appropriate speeds for 480x270 game area
- Wall collisions work properly
- Grenades bounce correctly using physics engine
- No more stuck projectiles at extreme positions 