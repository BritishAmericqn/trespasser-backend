# Backend Weapon System Fixes

## Issues Found and Fixed

### 1. **Players Didn't Have New Weapons**
- **Problem**: Default loadout only included rifle, pistol, grenade, rocket
- **Fix**: Updated `createPlayer` to give players a test loadout with new weapons:
  - Primary: SMG (to test new weapon type)
  - Secondary: Pistol
  - Support: Grenade, Smoke Grenade, Flashbang (3 slots total)

### 2. **Grenade Throwing Was Hardcoded**
- **Problem**: `handleGrenadeThrow` only looked for 'grenade' weapon, not other throwables
- **Fix**: Updated to check currently equipped weapon and support all throwable types

### 3. **Weapon Not Found Errors**
- **Problem**: Player's `weaponId` was set to 'rifle' but they had 'smg' as primary
- **Fix**: Set `weaponId` to match the actual primary weapon from loadout

### 4. **Missing Pellet Count**
- **Problem**: Shotgun pellet count wasn't being passed from client
- **Fix**: Added `pelletCount` pass-through in GameRoom weapon fire handler

### 5. **Debug Support Added**
- Added logging to track weapon firing issues
- Added `debug:give_weapon` event for testing specific weapons

### 6. **Grenade Timer Issue (FIXED)**
- **Problem**: Setting `fuseTime` on grenades changed their explosion behavior
- **Fix**: 
  - Separated throwable weapons (grenade, smoke, flash) from regular projectile weapons
  - Throwables can only be thrown with G key, not fired with left click
  - Ensured grenades have proper fuse time (3 seconds) set
  - Added explosion radius to grenade projectiles

### 7. **Grenade Not Exploding Issue (FIXED)**
- **Problem**: Frontend was trying to "fire" grenades with left-click, backend was blocking them
- **Fix**: 
  - Backend now automatically converts weapon:fire events for throwables into grenade:throw events
  - This maintains compatibility with frontend that fires grenades
  - Grenades now properly explode after 3 seconds
  - Added debug logging to track grenade lifecycle

## How Grenades Work Now

1. **Dual Support**: Grenades can be thrown with G key OR fired with left-click
2. **Auto-Conversion**: If fired, they're automatically converted to thrown grenades
3. **Proper Timer**: Grenades explode after 3 seconds (configured in FUSE_TIME)
4. **Charge System**: Regular grenades use charge level (1-5) for throw distance
5. **Debug Logging**: Console shows when grenades are created and when they explode

## Testing the Fixes

### Frontend Integration Required
The frontend needs to:
1. Send the correct `weaponType` that matches backend weapon names
2. Include `pelletCount: 8` when firing shotgun
3. Can use either G key or left-click for grenades (both work now)

### Debug Commands
From the frontend console:
```javascript
// Give yourself a specific weapon
socket.emit('debug:give_weapon', 'shotgun');
socket.emit('debug:give_weapon', 'machinegun');
socket.emit('debug:give_weapon', 'antimaterialrifle');

// Test grenade throwing
socket.emit('debug:throw_grenade');
```

## Current Status

✅ **Fixed Issues:**
- Players now spawn with new weapons
- Throwable weapons (smoke, flash) can be thrown
- Weapon switching uses equipped weapon ID
- Debug logging shows what's happening
- Grenades explode after 3 seconds properly
- Grenades work with both G key and left-click

🚧 **Needs Frontend Updates:**
- Ensure weapon type names match exactly (e.g., 'smg' not 'SMG')
- Send proper events for new weapon types
- Handle weapon switching UI for all weapons

## Next Steps

1. **Verify Frontend Events**: Check that the frontend is sending the correct weapon types
2. **Test Hit Detection**: Confirm hitscan weapons are detecting hits properly
3. **Test Projectiles**: Verify smoke grenades and flashbangs are being created
4. **Implement Effects**: Add smoke zone and flashbang effect handlers (Phase 2) 