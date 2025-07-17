# Wall Damage and Visibility Fixes

## Issues Fixed

### Issue 1: Walls Not Being Properly Destroyed (Low HP Problem)

**Problem**: When bullets penetrated soft walls, they always applied the full penetration damage (15) regardless of the wall's remaining health, causing bullets to lose more damage than they should.

**Example**: 
- Wall slice has 7 HP
- Rifle (25 damage) hits it
- **Before**: Wall takes 15 damage, bullet continues with 10 damage
- **After**: Wall takes 7 damage, bullet continues with 18 damage

**Solution**: 
```typescript
// Calculate actual penetration cost (limited by wall's remaining health)
const actualPenetrationCost = Math.min(penetrationDamage, sliceHealth);

if (currentDamage >= actualPenetrationCost) {
  const damageToWall = actualPenetrationCost;
  const remainingDamage = currentDamage - damageToWall;
  // Bullet now loses only the damage actually applied to the wall
}
```

### Issue 2: Soft Wall Visibility Threshold Too Low

**Problem**: The visibility threshold (25% health) was set lower than practical damage chunks (15 HP), creating a "dead zone" where walls should allow vision but weren't marked as destroyed.

**Old Thresholds**:
- Wood (80 HP): Visibility at <20 HP, destroyed at 0 HP
- Glass (30 HP): Visibility at <7.5 HP, destroyed at 0 HP

**New Thresholds**:
- Wood (80 HP): Visibility at ≤40 HP (50%), destroyed at 0 HP
- Glass (30 HP): Visibility at ≤15 HP (50%), destroyed at 0 HP

**Solution**:
```typescript
export function shouldSliceAllowVision(material: string, sliceHealth: number, maxHealth: number): boolean {
  if (isHardWall(material)) {
    return sliceHealth <= 0; // Hard walls: only when destroyed
  } else {
    const healthPercentage = sliceHealth / maxHealth;
    return healthPercentage <= 0.5; // Soft walls: 50% or less health
  }
}
```

## Gameplay Impact

### Penetration Now Works Correctly
- Bullets don't lose excessive damage when hitting low-health walls
- Low-health walls can be penetrated even by weaker bullets
- Damage application is now realistic and fair

### Visibility Progression for Soft Walls

**Wood Walls (80 HP per slice)**:
1. **80-41 HP**: Opaque (normal wall)
2. **40-1 HP**: Transparent (can see through)
3. **0 HP**: Destroyed (fully removed)

**Glass Walls (30 HP per slice)**:
1. **30-16 HP**: Opaque (normal wall)  
2. **15-1 HP**: Transparent (can see through)
3. **0 HP**: Destroyed (fully removed)

### Rifle Damage Examples

**Wood Wall (80 HP)**:
- 1st shot (25 dmg): 80 → 55 HP (still opaque)
- 2nd shot (25 dmg): 55 → 30 HP (now transparent!)
- 3rd shot (25 dmg): 30 → 5 HP (still transparent)
- 4th shot (25 dmg): 5 → 0 HP (destroyed)

**Glass Wall (30 HP)**:
- 1st shot (25 dmg): 30 → 5 HP (now transparent!)
- 2nd shot (25 dmg): 5 → 0 HP (destroyed)

## Technical Details

### Changes Made
1. Fixed penetration damage calculation in `raycastWithPenetration()`
2. Updated visibility threshold from 25% to 50% in `shouldSliceAllowVision()`
3. Added proper handling for low-health wall penetration
4. Maintained destruction threshold at 0 HP (destroyed = destroyed)

### Benefits
- More intuitive wall damage progression
- Better balance between cover and visibility
- Realistic bullet damage conservation
- Clear visual feedback for wall state 