# Shotgun Self-Hit Issue Fix

## Problem Description

Players were experiencing hit markers on themselves when firing the shotgun, indicating that some shotgun pellets were hitting the shooting player.

## Root Cause Analysis

The issue was caused by the following factors:

1. **Player Size**: Players have a radius of 6 pixels (`PLAYER_SIZE: 12` / 2)
2. **Pellet Origin**: All shotgun pellets were starting from the player's exact center position
3. **Spread Pattern**: With `SPREAD_ANGLE: 0.15` radians (~8.5 degrees), the random spread `(Math.random() - 0.5) * spreadAngle` created pellets with angles ranging from ±4.3 degrees from the aim direction
4. **Collision Detection**: Some pellets, due to their angle and the player's collision radius, were intersecting the player's own hitbox immediately upon firing

## Solution Implemented

### 1. Offset Pellet Starting Position

Modified the shotgun firing logic in `GameStateSystem.ts` to start all pellets in front of the player:

```typescript
// Calculate offset position in front of player to prevent self-hits
const playerRadius = GAME_CONFIG.PLAYER_SIZE / 2;
const offsetDistance = playerRadius + 2; // Start pellets 2 pixels beyond player edge
const offsetPosition = {
  x: event.position.x + Math.cos(event.direction) * offsetDistance,
  y: event.position.y + Math.sin(event.direction) * offsetDistance
};

// Use offsetPosition instead of event.position for pellet raycasting
const pelletHits = this.weaponSystem.performHitscanWithPenetration(
  offsetPosition, // Use offset position instead of player center
  pelletDirection,
  weapon.range,
  // ... other parameters
);
```

### 2. Safety Margin

- **Player radius**: 6 pixels
- **Offset distance**: 8 pixels (6 + 2 pixel buffer)
- **Result**: All pellets start 8 pixels in front of the player's center, well outside their collision radius

## Verification

The fix ensures that:
1. ✅ Shotgun pellets no longer start inside the player's collision radius
2. ✅ All other shooter exclusion logic remains intact
3. ✅ The visual/gameplay impact is minimal (8 pixels is barely noticeable at 480x270 resolution)
4. ✅ Shotgun spread and damage mechanics remain unchanged

## Other Weapons Checked

All other weapon systems already have proper shooter exclusion:
- **Hitscan weapons**: All raycast methods check `if (playerId === shooterId || !player.isAlive) continue;`
- **Projectiles**: All collision checks verify `if (playerId === projectile.ownerId || !player.isAlive) continue;`

## Files Modified

- `src/systems/GameStateSystem.ts`: Added offset position calculation for shotgun pellets

## Testing

To test the fix:
1. Start the server: `npm start`
2. Connect with a client and equip a shotgun
3. Fire the shotgun in various directions
4. Verify no self-hit markers appear

The fix should eliminate all instances of shotgun self-hits while maintaining proper pellet spread and damage distribution. 