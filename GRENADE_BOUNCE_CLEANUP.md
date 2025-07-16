# Grenade Bounce System Cleanup

## Problem
1. Grenades were exhibiting erratic bouncing behavior due to dual physics systems (Matter.js + manual) fighting each other.
2. Grenades were getting stuck running parallel to walls about 2 pixels away.
3. Corner bounces were unpredictable and unnatural.

## Solution Implemented
Removed Matter.js physics for grenades and implemented a robust manual physics system optimized for top-down gameplay.

## Changes Made

### 1. **Removed Matter.js Physics Body Creation**
- Grenades no longer create Matter.js bodies
- Prevents dual system conflicts
- More predictable behavior

### 2. **Implemented Top-Down Physics**
```typescript
// NO GRAVITY - this is a top-down game!
// Ground friction simulates rolling on floor
const GROUND_FRICTION = 0.95; // 5% speed loss per second
```

### 3. **Fixed Reflection Physics**
- **Standard reflection formula**: v_reflected = v - 2(v·n)n
- **Proper angle calculation**: Angle of incidence = angle of reflection
- **Correct normal direction**: Normal points outward from wall
- **Bounce factor applied**: 70% energy retention for lively gameplay
- **Friction applied after**: 85% speed retention
- **Result**: Grenades bounce AWAY from walls, not back at player

### 4. **Completely Rewrote Wall Bouncing**
- **Previous position tracking** - Determines which wall face was hit
- **Proper normal calculation** - Based on boundary crossing, not closest point
- **Corner handling** - Normalized diagonals for corner hits
- **Correct dot product** - Checks if moving INTO wall (dot < 0)
- **Better position correction** - Places grenade at exact collision point + radius
- **Safety checks** - Ensures grenade never gets stuck inside walls

### 5. **Enhanced Collision Detection**
- **Dynamic step calculation** - More steps for faster grenades (5 steps if > 50 px/s)
- **Removed movement threshold** - No longer skips slow-moving grenades
- **Collision cooldown** - Prevents double-bounces from same wall

### 6. **Fixed Wall Phasing**
- **Break after bounce** - Stops checking further collisions after bounce
- **More interpolation steps** - 8 steps for >60 px/s, 5 for >40 px/s
- **Robust position correction** - Ensures grenade is pushed outside wall
- **Double-check safety** - If still inside, push to nearest edge
- **Result**: No more grenades passing through walls at high speeds

### 7. **Fixed Stuck Bouncing**
- **Increased collision cooldown** - 200ms (was 100ms) between same-wall collisions
- **Don't snap to collision point** - Grenades keep current position on bounce
- **Larger separation distance** - Push 3+ pixels away (was 1 pixel)
- **Velocity-based push** - Fast grenades pushed further to prevent re-collision
- **Micro-bounce damping** - Heavy damping when speed < 5 px/s
- **Result**: No more grenades oscillating back and forth at walls

## Key Parameters

### Grenade Physics
- **Ground Friction**: 0.95 (5% loss per second)
- **Wall Bounce Factor**: 0.7 (30% energy loss - more elastic)
- **Wall Friction Factor**: 0.85 (15% tangential loss - smoother)
- **Grenade Radius**: 2 pixels
- **Collision Steps**: 3-5 (based on speed)
- **Push Distance**: radius + 0.1 pixels (minimal gap)

### Grenade Speed (24-96 px/s)
- **Base Speed**: 12 px/s (charge level 1 = 24 px/s)
- **Charge Bonus**: 18 px/s per level
- **Speed Range**: 24-96 px/s
- **Charge 1**: 24 px/s (no charge)
- **Charge 2**: 42 px/s
- **Charge 3**: 60 px/s
- **Charge 4**: 78 px/s
- **Charge 5**: 96 px/s (fully charged)
- **Range**: 150-375 pixels

## Result
- Natural, predictable bouncing behavior
- No dual physics conflicts
- Proper corner bounces
- No wall sticking or 2-pixel gaps
- Smooth high-speed collisions
- Consistent physics at all speeds

## Testing
Fire grenades at walls and boundaries to verify:
1. Natural bounce angles
2. Consistent energy loss
3. Clean corner bounces
4. No phasing at high speeds
5. No stuck grenades
6. Smooth wall slides 