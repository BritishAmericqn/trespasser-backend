# Vision and Rocket Damage Fixes

## Issues Fixed

### 1. ❌ Can't See Through Destroyed Walls
**Problem**: The raycasting vision system was stopping at ANY wall tile, even if it was 60%+ destroyed.

**Fix**: Modified `TileVisionSystem.castRay()` to continue the ray when a wall has 3+ destroyed slices:
```typescript
// Check if wall blocks further vision
if (this.wallTileIndices.has(tileIndex)) {
    // Check partial destruction
    const partial = this.partialWalls.get(tileIndex);
    if (partial) {
        // Count destroyed slices
        let destroyedCount = 0;
        let mask = partial.destroyedSlices;
        while (mask) {
            destroyedCount += mask & 1;
            mask >>= 1;
        }
        if (destroyedCount < 3) {
            break; // Wall still blocks (less than 60% destroyed)
        }
        // Otherwise continue - wall is destroyed enough to see through
    } else {
        break; // Solid wall blocks vision
    }
}
```

### 2. ❌ Rockets Do No Damage
**Problem**: Rocket explosions were creating damage events but NOT actually applying damage to walls.

**Fix**: Modified `GameStateSystem.processExplosions()` to call `destructionSystem.applyDamage()`:
```typescript
// Actually apply the damage to the wall!
const actualDamageResult = this.destructionSystem.applyDamage(
    wallDamageEvent.wallId, 
    wallDamageEvent.sliceIndex, 
    wallDamageEvent.damage
);
```

## Technical Details

### Vision System
- Using raycasting with 60 rays across 120° cone
- 8x8 tile grid (60×34 tiles total)
- Walls with 60%+ destruction (3+ slices) allow vision through

### Rocket Damage
- Rockets have 150 base damage with 50 pixel explosion radius
- Explosion damage falls off with distance
- Multiple wall slices can be damaged by one explosion
- Wall damage events are now properly applied and broadcast

## Testing

1. **Vision Test**: 
   - Damage a wall with rifle until 3+ slices are destroyed
   - You should now be able to see through the gap

2. **Rocket Test**:
   - Fire a rocket at a wall
   - Wall should take damage and show destruction
   - Multiple slices should be affected by the explosion

## Status

✅ Both fixes are implemented and built
⚠️ Frontend still needs to update to 60×34 grid for proper vision rendering 