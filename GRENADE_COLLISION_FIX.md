# Grenade Wall Collision Fix

## Problem
Grenades were passing through wall edges and only bouncing once they were inside the wall. This happened because:

1. **No Radius Consideration**: Line collision detection only checked if the grenade's center crossed the wall boundary, not when the grenade's edge touched it
2. **Delayed Bounce Handling**: When collision was detected, the code had a comment "Grenades bounce - handled elsewhere" but didn't actually handle it immediately
3. **Position Already Inside**: By the time the bounce was handled in `checkProjectileCollisions()`, the grenade was already inside the wall

## Solution

### 1. Radius-Based Collision Detection
- Added `GRENADE_RADIUS` constant (2 pixels)
- Modified `checkLineWallCollision` to accept a `projectileRadius` parameter
- Expanded wall bounds by the radius for collision detection
- Now detects collision when the grenade's edge touches the wall, not just the center

### 2. Immediate Bounce Handling
- Removed the "handled elsewhere" approach
- Now handles grenade bounce immediately when collision is detected
- Prevents the grenade from entering the wall in the first place

### 3. Proper Position Correction
When a grenade hits a wall:
- Determines which side of the wall was hit based on previous position
- Moves the grenade back to the wall edge (accounting for radius)
- Reflects velocity with damping (0.6x)
- Updates the physics body position and velocity

## Code Changes

### ProjectileSystem.ts
1. Added `GRENADE_RADIUS = 2` constant
2. Updated `checkLineWallCollision` to expand wall bounds by projectile radius
3. Added immediate bounce handling in the update loop
4. Position correction places grenade at wall edge + radius

## Result
Grenades now properly bounce off walls without passing through edges, creating more realistic and predictable physics behavior. 