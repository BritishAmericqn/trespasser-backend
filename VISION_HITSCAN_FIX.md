# Critical Fix: Vision System Not Updated for Hitscan Weapons

## The Bug

Vision system wasn't recognizing walls destroyed by rifles/pistols, only by rockets/explosions.

## Root Cause

The `onWallDestroyed` method was only being called for:
- ✅ Projectile collisions (rockets)
- ✅ Explosions (grenades/rockets)
- ❌ **NOT for hitscan weapons (rifle/pistol)**

This meant that when you shot a wall with a rifle:
1. The destruction system properly tracked the damage ✅
2. The wall visually appeared destroyed ✅
3. But the vision system was never notified ❌
4. So fog of war still blocked vision ❌

## The Fix

Added the missing `onWallDestroyed` call in the hitscan weapon handling:

```typescript
// In handleWeaponFire for hitscan weapons
if (damageEvent) {
    // ... existing damage handling ...
    
    // NEW: Notify vision system of wall damage
    this.visionSystem.onWallDestroyed(
        hitscanResult.targetId!,
        wall,
        damageEvent.sliceIndex
    );
}
```

## Testing

With the new debugging logs, you should see:
1. `🔍 onWallDestroyed called for wall_X slice Y` when shooting walls
2. Vision should now pass through ANY wall with destroyed slices
3. Fog of war should update properly when walls are damaged

## Status

✅ Fixed - Vision system now properly tracks ALL wall damage, not just explosions 