# 🔧 Partial Wall Bullet Pass-Through Fix

> **UPDATE**: The initial fix using `isSlicePhysicallyIntact()` was incorrect. The real issue was that pre-destroyed slices (health = 0) were being treated as "penetrable obstacles" instead of empty space.

## Problem Summary

**Issue**: Bullets were passing through some soft walls without registering hits or damage, particularly:
- Only affected certain soft walls (those with pre-destroyed slices from map loading)
- Angle-dependent behavior
- Vision system showed shadows correctly (wall appeared intact)

## Root Cause

The weapon system was checking the **wrong data** to determine if a slice was intact:

### The Bug Chain:
1. **Map loads partial walls** (e.g., 3-tile wall creates 5 slices but marks slices 3-4 as "destroyed")
2. **Soft walls at 50% health** have `destructionMask = 1` (allow vision) but `sliceHealth > 0` (should block bullets)
3. **Weapon raycast** checked `destructionMask === 0` instead of `sliceHealth > 0`
4. **Result**: Bullets skipped over damaged-but-intact slices

### Example Scenario:
```
1. 3-tile soft wall loaded from map
   - Slices 0-2: Health = 100, destructionMask = 0
   - Slices 3-4: Health = 0, destructionMask = 1 (pre-destroyed)

2. Player damages slice 1 to 40% health
   - Slice 1: Health = 40, destructionMask = 1 (allows vision at 50%)
   
3. Bullet hits pre-destroyed slice 3
   - Looks for intact slices using destructionMask
   - Skips slice 1 because destructionMask = 1
   - Passes through wall without hitting anything!
```

## The Fix

### Strategy: Check Actual Health, Not Vision Mask

Created a centralized function to determine if a slice is physically intact:

```typescript
export function isSlicePhysicallyIntact(sliceHealth: number): boolean {
  const DESTRUCTION_THRESHOLD = 0.01;
  return sliceHealth > DESTRUCTION_THRESHOLD;
}
```

### Changes Made:

1. **WeaponSystem.ts**
   - Changed from checking `destructionMask === 0` to `isSlicePhysicallyIntact(sliceHealth)`
   - Now correctly identifies any slice with health > 0.01 as blocking

2. **GameStateSystem.ts** (Movement)
   - Updated `canPlayerMoveTo()` to use same health check
   - Prevents "quantum walls" where players could move through walls that block bullets

3. **DestructionSystem.ts**
   - Updated `isPointInWallSlice()` for consistency
   - All collision systems now use the same logic

## Benefits

1. **Fixes the Bug**: Bullets now correctly hit damaged-but-intact slices
2. **Preserves Partial Walls**: Map design with non-mod-5 wall lengths continues working
3. **Maintains Vision Logic**: Soft walls still transparent at 50% health
4. **System Consistency**: Movement, weapons, and physics all agree on what's "solid"
5. **Prevents Edge Cases**: Float threshold (0.01) avoids precision issues

## Technical Details

### Why Not Just Fix destructionMask?
- `destructionMask` is used for **vision** (gameplay feature)
- Changing it would break the soft wall transparency mechanic
- Separate concerns: vision vs. physical collision

### Performance Considerations
- Health check is slightly slower than bitmask check
- But still O(1) operation per slice
- Minimal impact even in intense firefights

### Network Implications
- Health values already synced to clients
- No additional bandwidth required
- Consistent behavior across client/server

## Testing

To verify the fix:
1. Load a map with partial walls
2. Damage a soft wall to ~40% health
3. Try shooting through from various angles
4. Should always register hits on intact slices

## Future Considerations

If performance becomes an issue, consider:
- Caching a separate "physical collision mask"
- Pre-computing intact slice ranges
- But current solution is clean and maintainable 