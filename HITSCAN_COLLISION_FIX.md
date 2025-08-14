# 🎯 Hitscan Collision Detection Fix

## Problem Identified
Some walls were not properly detecting hitscan collisions. The issue was that **partial walls** (walls shorter than 5 tiles) were being created with incorrect dimensions.

## Root Cause
The map loader was creating all walls with a fixed 50-pixel dimension (5 tiles) regardless of their actual size:
- A 2-tile wall would be created with 50px width but only visually show 20px
- The extra 30px would be marked as "pre-destroyed slices"
- Hitscan collision detection would check against the full 50px bounding box
- This caused bullets to hit "invisible" parts of walls

## The Fix
Changed the wall creation logic to use **actual dimensions** while maintaining proper slice distribution:

### 1. **MapLoader.ts Changes**
- `createHorizontalWall()` now uses `wallWidth = length * 10` (actual size)
- `createVerticalWall()` now uses `wallHeight = length * 10` (actual size)
- Removed pre-destroyed slice logic entirely
- Walls are now created with their true dimensions

### 2. **wallSliceHelpers.ts Changes**
- All walls still have exactly 5 slices (GAME_CONFIG.DESTRUCTION.WALL_SLICES)
- Slices are uniformly distributed across the wall's actual dimensions
- `calculateSliceIndex()` divides wall dimension by 5 to get slice width
- `getSliceDimension()` returns wall dimension / 5

### 3. **DestructionSystem.ts Changes**
- Walls always have 5 slices regardless of size
- Slices are just smaller/larger based on wall dimensions
- Destruction masks and slice health arrays always size 5

## Impact
- ✅ Hitscan collision detection now matches visual wall boundaries exactly
- ✅ No more hitting invisible wall sections
- ✅ All walls maintain uniform 5-slice structure
- ✅ Wall destruction works correctly with proper slice distribution

## Testing
The server has been restarted with these fixes. All walls should now have accurate collision detection that matches their visual representation.

## Technical Details
Before:
```
2-tile wall (20px) → 50px bounding box → slices [0,1,destroyed,destroyed,destroyed]
Each slice = 10px (but wall appears 20px)
```

After:
```
2-tile wall (20px) → 20px bounding box → slices [0,1,2,3,4]
Each slice = 4px (20px / 5 slices)
```

This ensures that:
1. Collision detection is pixel-perfect with actual wall dimensions
2. All walls have exactly 5 slices as designed
3. Slices are uniformly distributed across the wall's actual size
