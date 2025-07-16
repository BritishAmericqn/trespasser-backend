# Manual Grenade Physics Implementation

## Overview

We've completely replaced the Matter.js physics for grenades with a robust manual physics implementation. This provides predictable, smooth grenade behavior without the issues we encountered with dual physics systems.

## Key Features

### 1. **Single Physics System**
- Grenades use **100% manual physics**
- No Matter.js bodies created for grenades
- Rockets still use Matter.js for simplicity
- No more dual system conflicts

### 2. **Swept Sphere Collision Detection**
```typescript
// Dynamic step calculation based on speed
const steps = Math.max(1, Math.ceil(distance / this.GRENADE_RADIUS));

// Check each interpolated position
for (let i = 1; i <= steps; i++) {
  const t = i / steps;
  const checkX = from.x + dx * t;
  const checkY = from.y + dy * t;
  // ... collision check
}
```

### 3. **Proper Reflection Physics**
```typescript
// Standard reflection formula: v' = v - 2(v·n)n
grenade.velocity.x -= 2 * dot * collision.normal.x;
grenade.velocity.y -= 2 * dot * collision.normal.y;

// Apply damping and friction
grenade.velocity.x *= this.GRENADE_BOUNCE_DAMPING;
grenade.velocity.y *= this.GRENADE_BOUNCE_DAMPING;
```

### 4. **Advanced Collision Handling**
- **Collision cooldown**: 150ms between same-wall collisions
- **Normal calculation**: Always points away from wall
- **Position correction**: Push to radius + 1px from wall
- **Wall friction**: Tangential velocity damping

## Physics Constants

```typescript
// Grenade physics constants
GRENADE_RADIUS = 2;                  // pixels
GRENADE_GROUND_FRICTION = 0.95;      // per second (5% speed loss)
GRENADE_BOUNCE_DAMPING = 0.7;        // energy retained after bounce
GRENADE_WALL_FRICTION = 0.85;        // tangential velocity retained
GRENADE_MIN_BOUNCE_SPEED = 10;       // px/s - below this, heavy damping
GRENADE_STUCK_THRESHOLD = 1;         // px/s - below this, grenade explodes
COLLISION_COOLDOWN_MS = 150;         // ms between same-wall collisions
```

## Implementation Details

### Update Loop
```typescript
private updateGrenade(grenade: ProjectileState, deltaTime: number, walls?: Map<string, WallState>): void {
  const deltaSeconds = deltaTime / 1000;
  
  // Apply ground friction
  grenade.velocity.x *= Math.pow(this.GRENADE_GROUND_FRICTION, deltaSeconds);
  grenade.velocity.y *= Math.pow(this.GRENADE_GROUND_FRICTION, deltaSeconds);
  
  // Calculate new position
  const newX = grenade.position.x + grenade.velocity.x * deltaSeconds;
  const newY = grenade.position.y + grenade.velocity.y * deltaSeconds;
  
  // Swept sphere collision detection
  const collision = this.checkGrenadeMovement(prevPos, { x: newX, y: newY }, walls);
  
  if (collision) {
    this.handleGrenadeCollision(grenade, collision);
  } else {
    grenade.position.x = newX;
    grenade.position.y = newY;
  }
  
  // Handle boundary collisions
  this.handleGrenadeBoundaryCollision(grenade);
}
```

### Collision Detection
- Expands wall bounds by grenade radius
- Checks if grenade center is inside expanded bounds
- Finds closest point on actual wall
- Calculates proper collision normal

### Bounce Behavior
1. **Direct hits**: Bounce back with 70% energy
2. **Angled hits**: Proper reflection angle
3. **Shallow angles**: Smooth sliding along walls
4. **Slow speeds**: Extra damping to prevent micro-bounces
5. **Stuck detection**: Explodes if speed < 1 px/s

## Benefits

### 1. **Predictable Behavior**
- Consistent bounce angles
- No random physics glitches
- Smooth wall sliding

### 2. **Performance**
- No physics engine overhead for grenades
- Efficient collision detection
- Minimal memory allocation

### 3. **No More Issues**
- ✅ No wall phasing
- ✅ No stuck bouncing
- ✅ No oscillation
- ✅ No 2-pixel gaps
- ✅ Proper corner handling

## Testing

Use the test script to verify all physics behaviors:

```bash
node test-grenade-manual-physics.js
```

This runs a comprehensive test suite:
1. Direct wall bounce (90°)
2. Angled wall bounce (45°)
3. Shallow angle slide
4. Corner bounce
5. Boundary bounce
6. Multiple bounces
7. Slow speed damping

## Migration Notes

### From Previous Implementation
- Removed all Matter.js grenade code
- Deleted `createProjectileBody` calls for grenades
- Removed physics collision callbacks
- Implemented manual update loop

### Speed Range
The grenade speeds remain the same:
- **Charge 1**: 24 px/s
- **Charge 2**: 42 px/s
- **Charge 3**: 60 px/s
- **Charge 4**: 78 px/s
- **Charge 5**: 96 px/s

### Range
- **Min**: 150 pixels (6.25 seconds at min speed)
- **Max**: 375 pixels (3.9 seconds at max speed)

## Debugging

Enable logging by uncommenting debug lines:
```typescript
// console.log(`🎾 BOUNCE DETECTED!`);
// console.log(`Position: (${grenade.position.x}, ${grenade.position.y})`);
// console.log(`Normal: (${collision.normal.x}, ${collision.normal.y})`);
```

## Future Improvements

1. **Spin/rotation**: Add visual rotation based on velocity
2. **Material types**: Different bounce factors for different walls
3. **Sound triggers**: Emit events for bounce sounds
4. **Trail optimization**: Smooth interpolation for visual trails 