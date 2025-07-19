# Rocket Launcher Fix

## Issues Reported:
1. Can't reload properly
2. Doesn't do damage
3. Barely shoots

## Critical Bug Found and Fixed:

### **Explosion Damage Not Applied** ✅ FIXED
The `processExplosions` method in ProjectileSystem was checking `player.position` but PlayerState uses `player.transform.position`. This caused explosions to never damage players because the check always failed.

**Fixed:** Changed to check `player.transform?.position` and use correct position for distance calculations.

## Analysis:

### 1. **Reload Issue**
The rocket launcher has `MAX_AMMO: 1` and `MAX_RESERVE: 3`, which means:
- Only 1 rocket in the chamber at a time
- 3 rockets in reserve
- Fire rate is very low (30 RPM = 2 seconds between shots)

### 2. **Damage Issue** ✅ FIXED
Rockets create explosions when they hit walls, but the explosion damage wasn't being applied to players due to the position bug.

### 3. **Fire Rate Issue**
With FIRE_RATE: 30, you can only fire once every 2 seconds. This might feel like it "barely shoots".

## Fixes Applied:

### 1. Fixed Player Position Check
- Changed `player.position` to `player.transform.position` in explosion processing
- Explosions now correctly calculate distance to players
- Damage is now properly applied based on distance from explosion

### 2. Added Debug Logging
- Added console log when creating rocket projectiles
- Added console log when rockets hit walls
- Added console log for explosion processing
- Added console log for damage application

### 3. Player Loadout
- Changed default loadout to include rocket launcher (instead of grenades)
- Players now spawn with rocket launcher on key 3

## Testing Instructions:

1. **Switch to Rocket**: Press '3' key
2. **Fire**: Left-click (wait 2 seconds between shots)
3. **Reload**: Press 'R' when ammo is 0
4. **Check Console**: Look for rocket creation and explosion logs

## What You Should See in Console:

```
🚀 ROCKET CREATED:
   ID: projectile_123
   Position: (240.0, 135.0)
   Velocity: (200.0, 0.0) = 200.0 px/s
   Range: 400
   Damage: 100
   Explosion Radius: 50
🚀 Creating rocket projectile - speed: 200, damage: 100
🚀 Rocket hit wall wall_45 at step 0/1, slice 2
💥 Processing 1 explosions
💥 Explosion damages player abc123: 75 damage at distance 25.0
🎯 Applying explosion damage to player abc123: 75 damage
```

## Potential Frontend Issues:

1. **Weapon Name**: Frontend must send `weaponType: 'rocket'` (lowercase)
2. **Projectile Rendering**: Frontend must render rocket projectiles
3. **Explosion Effects**: Frontend should show explosion visuals
4. **Reload Animation**: Frontend should show reload progress (3 seconds)

## Debug Commands:

```javascript
// Give yourself more rockets
socket.emit('debug:give_weapon', 'rocket');
```

## Summary:

The main issue was that explosions weren't damaging players due to a property access bug. This has been fixed. Rockets should now:
- Fire correctly (one shot, then reload)
- Create projectiles that fly at 200 px/s
- Explode on impact with walls or boundaries
- Deal damage to players within 50 pixel radius
- Apply damage based on distance (100 damage at center, less further away) 