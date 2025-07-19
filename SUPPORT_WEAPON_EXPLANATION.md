# Support Weapon System Explanation

## How Support Weapons Work

The support weapon system uses a **slot-based approach** where different weapons have different slot costs:

### Slot Costs:
- **1 Slot**: grenade, smokegrenade, flashbang
- **2 Slots**: grenadelauncher, machinegun, antimaterialrifle
- **3 Slots**: rocket

### Maximum: 3 Slots Total

## Valid Loadout Examples:

### Example 1: Three Throwables (Current Default)
```javascript
support: ['grenade', 'smokegrenade', 'flashbang'] // 1+1+1 = 3 slots
```
- Key 3: grenade
- Key 4: smokegrenade
- Key 5: flashbang (if key 5 was available)

### Example 2: Rocket Only
```javascript
support: ['rocket'] // 3 slots
```
- Key 3: rocket

### Example 3: Machine Gun + Grenade
```javascript
support: ['machinegun', 'grenade'] // 2+1 = 3 slots
```
- Key 3: machinegun
- Key 4: grenade

### Example 4: Grenade Launcher + Flash
```javascript
support: ['grenadelauncher', 'flashbang'] // 2+1 = 3 slots
```
- Key 3: grenadelauncher
- Key 4: flashbang

## Important Notes:

1. **No Duplicates**: The weapon system uses a Map with weapon type as key, so you can't have multiple instances of the same weapon (e.g., 3 separate grenades). Instead, grenades have ammo counts.

2. **Key Bindings**: Currently only keys 3 and 4 are available for support weapons. To use more than 2 support weapons, the frontend would need to add key 5 to the InputState.

3. **Ammo vs Instances**: When you want "3 grenades", that's handled by the weapon's ammo count (MAX_AMMO: 2), not by having 3 weapon instances.

## To Test Different Loadouts:

Change the support array in GameStateSystem.ts createPlayer():

```javascript
// For rocket testing:
support: ['rocket'] as WeaponType[]

// For machine gun + grenade:
support: ['machinegun', 'grenade'] as WeaponType[]

// For all throwables:
support: ['grenade', 'smokegrenade', 'flashbang'] as WeaponType[]
```

## Frontend Requirements:

1. Display support weapons on keys 3, 4 (and 5 if added)
2. Show appropriate icons/UI for each weapon type
3. Handle weapon switching between support slots
4. Display ammo counts for each weapon 