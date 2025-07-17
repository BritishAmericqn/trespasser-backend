# 🚀 Comprehensive Fix: Projectiles Through Destroyed Wall Slices

## Overview

Both grenades and rockets now properly pass through destroyed wall slices instead of bouncing off or exploding on impact with destroyed areas.

## Issues Fixed

### 1. **Grenades Bouncing Off Destroyed Walls** ✅
- **Problem**: Grenades would bounce off walls even when the slice they hit was destroyed
- **Location**: `ProjectileSystem.ts` - `checkGrenadeMovement()` method
- **Fix**: Added slice destruction check before returning collision

### 2. **Rockets Exploding on Destroyed Walls** ✅  
- **Problem**: Rockets would explode when hitting destroyed wall slices
- **Location**: `ProjectileSystem.ts` - `checkLineWallCollision()` method
- **Fix**: Added slice destruction check before returning collision

## Technical Implementation

### Grenade Fix
```typescript
// checkGrenadeMovement() - Line ~375
if (distSq < this.GRENADE_RADIUS * this.GRENADE_RADIUS) {
  // ✅ NEW: Check if the slice at collision point is destroyed
  const sliceIndex = calculateSliceIndex(wall, { x: closestX, y: closestY });
  
  // If this slice is destroyed, grenade should pass through
  if (wall.destructionMask && wall.destructionMask[sliceIndex] === 1) {
    continue; // Skip this collision, grenade passes through destroyed slice
  }
  
  // Slice is intact - proceed with normal collision
  // ... normal bounce physics
}
```

### Rocket Fix
```typescript
// checkLineWallCollision() - Line ~650
if (tMin <= tMax && tMax >= 0 && tMin <= 1) {
  const hitX = start.x + dx * Math.max(0, tMin);
  const hitY = start.y + dy * Math.max(0, tMin);
  const sliceIndex = calculateSliceIndex(wall, { x: hitX, y: hitY });
  
  // ✅ NEW: Check if the slice at collision point is destroyed
  if (wall.destructionMask && wall.destructionMask[sliceIndex] === 1) {
    return { hit: false }; // Rocket passes through destroyed slice
  }
  
  // Slice is intact - proceed with normal collision
  return { hit: true, sliceIndex: sliceIndex };
}
```

## How It Works

### 1. **Collision Detection**
- Both projectiles calculate which wall slice they're hitting using `calculateSliceIndex()`
- This works for both horizontal and vertical walls based on wall orientation

### 2. **Destruction Check**
- `wall.destructionMask[sliceIndex] === 1` means the slice is destroyed
- `wall.destructionMask[sliceIndex] === 0` means the slice is intact

### 3. **Conditional Behavior**
- **If slice is destroyed**: Projectile passes through (no collision)
- **If slice is intact**: Normal collision behavior (bounce/explode)

## Comparison with Working Systems

**Hitscan weapons (rifles/pistols) already worked correctly:**
```typescript
// WeaponSystem.ts - Already checks for destroyed slices
if (wall.destructionMask[sliceIndex] === 1) {
  continue; // Bullet passes through destroyed slice
}
```

## Testing Results

### Before Fix:
- ❌ Grenades bounced off destroyed walls
- ❌ Rockets exploded on destroyed wall slices
- ❌ Inconsistent behavior vs hitscan weapons

### After Fix:
- ✅ Grenades pass through destroyed slices smoothly
- ✅ Rockets fly through destroyed areas
- ✅ Consistent behavior across all weapon types
- ✅ Tactical gameplay: Create sight lines and projectile paths

## Gameplay Impact

### Enhanced Tactical Depth
1. **Destructible Cover**: Destroy wall slices to create new projectile paths
2. **Tactical Positioning**: Use destroyed areas for grenade/rocket trajectories  
3. **Consistent Physics**: All projectiles behave predictably with destruction
4. **Strategic Destruction**: Create precise openings for specific weapons

### Example Scenarios
- Destroy middle slice of a wall to create grenade trajectory
- Create rocket paths through walls by destroying key slices
- Use destruction to change map flow and create new tactical options

## Files Modified

- ✅ `src/systems/ProjectileSystem.ts` - Added slice checks to both grenade and rocket collision
- ✅ `src/utils/wallSliceHelpers.ts` - Provides `calculateSliceIndex()` helper
- ✅ `shared/types/index.ts` - Wall orientation support for proper slice calculation

## Status: Complete ✅

Both grenade and rocket collision systems now properly respect wall destruction state, creating consistent and tactical gameplay mechanics. 