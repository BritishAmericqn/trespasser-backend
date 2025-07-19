# Grenade and Rocket Fix

## Issues Found and Fixed

### 1. **Grenades Not Firing** ✅ FIXED
- **Problem**: When grenades were fired with left-click, they were converted to throw events but no `weapon:fired` event was sent back
- **Symptom**: Frontend showed "Cleaning up expired pending shot" because it was waiting for confirmation
- **Fix**: Added `weapon:fired` event to the throw result when converting fire to throw

### 2. **Default Loadout Mismatch** ✅ FIXED  
- **Frontend expects**: SMG, Pistol, ['grenade', 'rocket']
- **Backend had**: Rifle, Revolver, ['rocket', 'grenade']
- **Fix**: Updated backend to match frontend defaults

### 3. **Weapon Slot Costs** ✅ FIXED
- Rocket: 2 slots (was 3)
- Machine gun: 3 slots (was 2)  
- Anti-material rifle: 3 slots (was 2)

## How It Works Now

When a throwable weapon (grenade, smokegrenade, flashbang) is fired:
1. Backend detects it's a throwable
2. Converts the fire event to a throw event with appropriate charge level
3. Creates the projectile
4. **NEW**: Also sends `weapon:fired` event for frontend compatibility
5. Frontend receives confirmation and renders the projectile

## Testing

With the default loadout you should be able to:
- Key 1: SMG (primary)
- Key 2: Pistol (secondary)
- Key 3: Grenade (support slot 1)
- Key 4: Rocket (support slot 2)

Both grenades and rockets should work with left-click firing.

## Code Structure Issue Found

There's a bracket nesting issue in `handleWeaponFire` that needs fixing. The hitscan weapon handling has incorrect indentation starting at line 592. The structure should be:

```typescript
if (weaponConfig.HITSCAN) {
  if (weapon.type === 'shotgun') {
    // shotgun handling
  } else {
    // other hitscan weapons
  }
} else {
  // projectile weapons
}
```

This structural issue may be causing some hitscan weapons to not work properly. 