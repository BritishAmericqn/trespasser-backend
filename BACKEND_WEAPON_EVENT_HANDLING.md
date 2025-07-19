# Backend Weapon Event Handling Guide

## Overview
The frontend sends weapon events via Socket.IO for all 15 weapons. This guide explains what events to expect, what data they contain, and what responses the frontend expects.

## 1. Incoming Events from Frontend

### `weapon:fire`
Sent when ANY weapon is fired (including thrown weapons).

```javascript
// Incoming data structure
{
  weaponType: string,        // One of 15 weapon types (see list below)
  position: {x, y},         // Player's current position
  targetPosition: {x, y},   // Where player aimed (mouse position)
  direction: number,        // Angle in radians
  isADS: boolean,          // Aim down sights state
  timestamp: number,       // Client timestamp
  sequence: number,        // Input sequence number
  
  // Weapon-specific fields:
  pelletCount: 8,          // ONLY for shotgun
  chargeLevel: 1-5         // ONLY for grenades (1 for smoke/flash)
}
```

**Weapon Types:**
- Primary: `rifle`, `smg`, `shotgun`, `battlerifle`, `sniperrifle`
- Secondary: `pistol`, `revolver`, `suppressedpistol`
- Support: `grenade`, `smokegrenade`, `flashbang`, `grenadelauncher`, `rocket`, `machinegun`, `antimaterialrifle`

### `weapon:switch`
Sent when player switches weapons.

```javascript
{
  fromWeapon: string,      // Previous weapon type
  toWeapon: string,        // New weapon type
  timestamp: number
}
```

### `weapon:reload`
Sent when player starts reloading.

```javascript
{
  weaponType: string,
  timestamp: number
}
```

### `ads:toggle`
Sent when player toggles aim down sights.

```javascript
{
  isADS: boolean,
  timestamp: number
}
```

## 2. Backend Processing Requirements

### For `weapon:fire` Event

1. **Validate ammo** - Check if player has ammo for this weapon
2. **Apply fire rate limiting** - Enforce server-side RPM limits
3. **Calculate hit** - Use authoritative physics to determine what was hit
4. **Apply weapon-specific mechanics**:

#### Hitscan Weapons (instant hit)
```javascript
// Rifle, SMG, Pistol, Revolver, etc.
const hitResult = performHitscan(position, direction, weaponRange);

if (hitResult.hitPlayer) {
  // Send hit confirmation
  socket.emit('weapon:hit', {
    playerId: shooter.id,
    targetId: hitResult.player.id,
    position: hitResult.position,
    damage: weaponDamage,
    weaponType: data.weaponType
  });
  
  // Notify damaged player
  targetSocket.emit('player:damaged', {
    playerId: hitResult.player.id,
    damage: weaponDamage,
    newHealth: hitResult.player.health - weaponDamage,
    attackerId: shooter.id
  });
  
} else if (hitResult.hitWall) {
  // Send wall damage event
  socket.emit('wall:damaged', {
    wallId: hitResult.wall.id,
    sliceIndex: hitResult.sliceIndex,
    position: hitResult.position,
    playerId: shooter.id,
    weaponType: data.weaponType,
    newHealth: newSliceHealth,
    isDestroyed: newSliceHealth <= 0
  });
  
} else {
  // Send miss event
  socket.emit('weapon:miss', {
    playerId: shooter.id,
    weaponType: data.weaponType,
    direction: data.direction,
    position: calculateMaxRangePosition(position, direction)
  });
}
```

#### Shotgun (special case)
```javascript
if (data.weaponType === 'shotgun' && data.pelletCount === 8) {
  // Fire 8 pellets with spread
  for (let i = 0; i < 8; i++) {
    const pelletAngle = data.direction + (Math.random() - 0.5) * 0.15;
    const pelletResult = performHitscan(position, pelletAngle, shotgunRange);
    // Process each pellet hit...
  }
}
```

#### Projectile Weapons
```javascript
// Grenade, Rocket, Grenade Launcher, etc.
const projectileTypes = ['grenade', 'smokegrenade', 'flashbang', 'grenadelauncher', 'rocket'];

if (projectileTypes.includes(data.weaponType)) {
  const projectile = {
    id: generateId(),
    type: data.weaponType,  // MUST match exactly!
    position: {...data.position},
    velocity: calculateProjectileVelocity(data.direction, data.chargeLevel),
    ownerId: shooter.id
  };
  
  // Notify all clients
  io.emit('projectile:created', projectile);
  
  // Start physics simulation for projectile
  simulateProjectile(projectile);
}
```

### For `weapon:switch` Event

```javascript
// Update player's current weapon
player.currentWeapon = data.toWeapon;

// Broadcast to all clients
io.emit('weapon:switched', {
  playerId: player.id,
  fromWeapon: data.fromWeapon,
  toWeapon: data.toWeapon
});
```

### For `weapon:reload` Event

```javascript
// Start reload timer
const reloadTime = RELOAD_TIMES[data.weaponType];

setTimeout(() => {
  // Refill magazine
  player.weapons[data.weaponType].currentAmmo = MAGAZINE_SIZES[data.weaponType];
  player.weapons[data.weaponType].reserveAmmo -= MAGAZINE_SIZES[data.weaponType];
  
  // Notify client
  socket.emit('weapon:reloaded', {
    weaponType: data.weaponType,
    newAmmo: player.weapons[data.weaponType].currentAmmo,
    reserveAmmo: player.weapons[data.weaponType].reserveAmmo
  });
}, reloadTime);
```

## 3. Required Outgoing Events to Frontend

### `weapon:fired` (broadcast to all)
```javascript
{
  playerId: string,         // Who fired
  position: {x, y},        // Where they fired from
  direction: number,       // Direction they fired
  weaponType: string       // What weapon they used
}
```

### `weapon:hit`
```javascript
{
  playerId: string,        // Who fired
  targetId: string,        // Who/what was hit (optional)
  position: {x, y},        // Hit location
  damage: number,
  weaponType: string,
  startPosition: {x, y}    // Optional: for bullet trail
}
```

### `weapon:miss`
```javascript
{
  playerId: string,
  weaponType: string,
  direction: number,
  position: {x, y}         // Where bullet ended up
}
```

### `wall:damaged`
```javascript
{
  wallId: string,
  sliceIndex: number,      // 0-4
  position: {x, y},        // Hit position
  playerId: string,
  weaponType: string,
  material: string,        // Wall material type
  newHealth: number,
  isDestroyed: boolean
}
```

### `projectile:created`
```javascript
{
  id: string,
  type: string,            // MUST be exact: 'grenade', 'rocket', etc.
  position: {x, y},
  velocity: {x, y},
  ownerId: string
}
```

### `projectile:updated`
```javascript
{
  id: string,
  position: {x, y}
}
```

### `projectile:exploded`
```javascript
{
  id: string,
  position: {x, y},
  radius: number           // Explosion radius
}
```

### `explosion:created`
```javascript
{
  position: {x, y},
  radius: number,
  weaponType: string,      // What caused explosion
  damagedWalls: [{         // Optional: walls damaged
    wallId: string,
    position: {x, y},
    material: string
  }]
}
```

## 4. Special Weapon Mechanics

### Machine Gun Overheating
```javascript
// Track heat per player
if (data.weaponType === 'machinegun') {
  player.machinegunHeat = (player.machinegunHeat || 0) + 5;
  
  if (player.machinegunHeat >= 100) {
    // Force cooldown
    socket.emit('weapon:heat:update', {
      weaponType: 'machinegun',
      heatLevel: 100,
      isOverheated: true
    });
  }
}
```

### Anti-Material Rifle Penetration
```javascript
if (data.weaponType === 'antimaterialrifle') {
  // Trace through multiple targets
  const hits = performPenetratingHitscan(position, direction, maxPenetrations: 3);
  
  // Send penetration event
  socket.emit('backend:wall:penetrated', {
    wallIds: hits.map(h => h.wallId),
    positions: hits.map(h => h.position),
    remainingDamage: calculateRemainingDamage(hits)
  });
}
```

### Smoke Grenade Vision Blocking
```javascript
case 'smokegrenade':
  // Create vision-blocking zone
  const smokeZone = {
    id: generateId(),
    position: explosionPos,
    radius: 60,
    duration: 10000
  };
  
  activeSmokesZones.push(smokeZone);
  
  io.emit('backend:smoke:deployed', {
    id: smokeZone.id,
    position: explosionPos,
    radius: 60
  });
  
  // Update vision calculations for affected players
  recalculateVisionForNearbyPlayers(explosionPos, 60);
  break;
```

### Flashbang Effects
```javascript
case 'flashbang':
  const affected = [];
  
  for (const player of getNearbyPlayers(explosionPos, 100)) {
    const distance = getDistance(player.position, explosionPos);
    const angleToFlash = Math.atan2(
      explosionPos.y - player.position.y,
      explosionPos.x - player.position.x
    );
    const angleDiff = Math.abs(player.rotation - angleToFlash);
    
    // More effect if looking at flash
    const facingMultiplier = angleDiff < Math.PI/2 ? 1.5 : 1.0;
    const intensity = (1 - distance/100) * facingMultiplier;
    
    affected.push({
      playerId: player.id,
      intensity: intensity,
      duration: 2000 * intensity
    });
  }
  
  io.emit('backend:flashbang:detonated', {
    position: explosionPos,
    affected: affected
  });
  break;
```

## 5. Important Notes

1. **Always include `weaponType`** in response events - frontend uses this to match pending shots
2. **Use exact weapon names** - `rocket` not `rocketlauncher` (except in audio system)
3. **Include `position`** in damage/hit events for visual feedback
4. **Validate all inputs** - Don't trust client data for damage/physics
5. **Track ammo server-side** - Prevent cheating
6. **Send projectile updates** at ~20Hz for smooth movement
7. **Include `playerId`** in all events so frontend knows who did what

## 6. Testing Checklist

- [ ] All 15 weapons fire and get responses
- [ ] Shotgun fires 8 pellets with spread
- [ ] Projectiles create visible entities
- [ ] Reload events update ammo properly
- [ ] Weapon switching broadcasts to all players
- [ ] Special mechanics work (heat, penetration, smoke, flash)
- [ ] Hit/miss events include proper position data
- [ ] Wall damage events include material type
- [ ] Explosions have appropriate radius 