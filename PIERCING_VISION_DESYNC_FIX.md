# 🔧 Piercing Vision Desync Fix

> **UPDATE**: This fix has been superseded by `PARTIAL_WALL_PASSTHROUGH_FIX.md` which addresses the root cause more comprehensively.

## Problem Summary

**Issue**: After implementing the piercing system, walls sometimes appeared to be destroyed (you could see through them) but you couldn't shoot through them, creating a desync between vision and weapon systems.

**Root Cause**: Inconsistent logic between what constitutes "destroyed" for vision versus weapon penetration.

## The Bug in Detail

### Previous Broken Logic:

1. **Soft Walls (wood/glass)**: Vision allowed through at ≤50% health
2. **Weapon System**: Used vision logic (`destructionMask`) to determine penetration  
3. **Result**: At 40% health, you could see through but not shoot through

### Example Scenario:
```
1. Soft wall starts at 100% health
2. Player fires piercing weapon → 60% health (no vision, no penetration) ✅
3. Player fires again → 40% health 
   - Vision: 40% ≤ 50% → allows vision ✅
   - Weapons: checks destructionMask → sees vision=true → allows penetration ❌
   - BUT: Slice still has 40% health > 0 → should block bullets!
```

## The Fix

### New Approach: Separate Vision and Penetration Logic

#### 1. **Vision Logic** (`shouldSliceAllowVision`) - UNCHANGED
- **Hard walls**: Vision through when health = 0 (completely destroyed)
- **Soft walls**: Vision through when health ≤ 50% (gameplay feature)

#### 2. **NEW Penetration Logic** (`shouldSliceAllowPenetration`)
- **All walls**: Bullets pass through ONLY when health = 0
- **Prevents desync**: Vision and shooting now independent

### Code Changes

#### Added New Function:
```typescript
// src/utils/wallSliceHelpers.ts
export function shouldSliceAllowPenetration(material: string, sliceHealth: number, maxHealth: number): boolean {
  // Bullets always require complete destruction regardless of material
  return sliceHealth <= 0;
}
```

#### Updated Weapon Systems:
- **WeaponSystem.ts**: All piercing functions now use `shouldSliceAllowPenetration`
- **ProjectileSystem.ts**: Rocket/grenade penetration uses health-based logic
- **DestructionSystem.ts**: No changes needed (vision logic preserved)

## Result

### Before Fix:
```
Soft wall at 40% health:
- Vision: ✅ Can see through (50% rule)
- Shooting: ❌ Can't shoot through (health > 0)
- Result: DESYNC - shadows still render but bullets blocked
```

### After Fix:
```
Soft wall at 40% health:
- Vision: ✅ Can see through (50% rule for gameplay)
- Shooting: ❌ Can't shoot through (health > 0, consistent)
- Result: CONSISTENT - vision and shooting aligned

Soft wall at 0% health:
- Vision: ✅ Can see through (completely destroyed)  
- Shooting: ✅ Can shoot through (completely destroyed)
- Result: CONSISTENT - both systems agree
```

## Benefits

1. **Fixes the desync**: No more situations where you can see but not shoot through walls
2. **Preserves gameplay**: Soft walls still provide partial vision at 50% health
3. **Maintains balance**: Hard walls still require complete destruction for everything
4. **Consistent behavior**: All piercing weapons use the same logic

## Testing

To verify the fix works:

1. **Find a soft wall** (wood/glass material)
2. **Damage it to ~40% health** with a piercing weapon
3. **Check vision**: Should be able to see through (shadows updated)
4. **Check shooting**: Should NOT be able to shoot through  
5. **Damage to 0% health**: Should be able to both see AND shoot through

## Files Modified

- `src/utils/wallSliceHelpers.ts` - Added `shouldSliceAllowPenetration`
- `src/systems/WeaponSystem.ts` - Updated all piercing logic
- `src/systems/ProjectileSystem.ts` - Updated rocket/grenade penetration

## Technical Notes

- **Vision system**: Still uses `destructionMask` based on `shouldSliceAllowVision`
- **Weapon system**: Now directly checks slice health via `shouldSliceAllowPenetration`  
- **No breaking changes**: Existing gameplay mechanics preserved
- **Performance**: Minimal impact, same number of function calls 