# Backend Weapon Implementation Requirements

## Overview
The frontend has been updated to support 15 weapon types across Primary, Secondary, and Support categories. This document outlines the exact backend changes needed to make these weapons fully functional.

## 1. Weapon Data Configuration

### Magazine Sizes (shots per reload)
```javascript
const MAGAZINE_SIZES = {
  // Primary Weapons
  rifle: 30,
  smg: 35,
  shotgun: 8,
  battlerifle: 20,
  sniperrifle: 5,
  
  // Secondary Weapons
  pistol: 12,
  revolver: 6,
  suppressedpistol: 15,
  
  // Support Weapons
  grenadelauncher: 6,
  machinegun: 100,
  antimaterialrifle: 5,
  
  // Thrown Weapons (total count)
  grenade: 2,
  smokegrenade: 2,
  flashbang: 2,
  rocket: 1  // Rocket launcher
};
```

### Reload Times (milliseconds)
```javascript
const RELOAD_TIMES = {
  rifle: 2500,
  smg: 2000,
  shotgun: 3500,      // Shell-by-shell reload
  battlerifle: 2800,
  sniperrifle: 3500,
  pistol: 1500,
  revolver: 3000,
  suppressedpistol: 1800,
  grenadelauncher: 4000,
  machinegun: 5000,
  antimaterialrifle: 4500,
  rocket: 3000
};
```

### Reserve Ammo Limits
```javascript
const MAX_RESERVE_AMMO = {
  // Primary
  rifle: 180,         // 6 extra mags
  smg: 210,           // 6 extra mags
  shotgun: 32,        // 32 extra shells
  battlerifle: 120,   // 6 extra mags
  sniperrifle: 30,    // 6 extra mags
  
  // Secondary
  pistol: 72,         // 6 extra mags
  revolver: 36,       // 6 extra cylinders
  suppressedpistol: 90, // 6 extra mags
  
  // Support
  grenadelauncher: 18, // 3 extra reloads
  machinegun: 300,    // 3 extra belts
  antimaterialrifle: 20, // 4 extra mags
  
  // Thrown
  grenade: 2,
  smokegrenade: 2,
  flashbang: 2,
  rocket: 3
};
```

## 2. Special Weapon Mechanics

### Shotgun
**Action Required:**
- When receiving fire event with `weaponType: 'shotgun'`, check for `pelletCount: 8`
- Generate 8 separate projectiles with spread pattern:
  ```javascript
  const baseAngle = data.direction;
  const spreadAngle = 0.15; // radians (~8.5 degrees)
  for (let i = 0; i < 8; i++) {
    const pelletAngle = baseAngle + (Math.random() - 0.5) * spreadAngle;
    // Create hitscan ray for each pellet
    // Each pellet does weaponDamage / 8
  }
  ```
- Each pellet should have individual hit detection
- Damage falloff: 100% damage at < 10m, 50% at 20m, 25% at 30m+

### Machine Gun Overheating
**Action Required:**
- Track heat level (0-100) per player's machine gun
- Heat gain: +5 per shot
- Cooldown: -10 per second when not firing
- When heat > 80: Reduce accuracy by 50%
- When heat = 100: Force 3-second cooldown, cannot fire
- Send heat level updates to client:
  ```javascript
  socket.emit('weapon:heat:update', {
    weaponType: 'machinegun',
    heatLevel: 85,
    isOverheated: false
  });
  ```

### Anti-Material Rifle Penetration
**Action Required:**
- When firing, trace ray through multiple targets
- Can penetrate up to 3 walls or 2 players
- Damage reduction per penetration:
  - First wall: 20% damage loss
  - Second wall: 40% damage loss  
  - Third wall: 60% damage loss
- Send penetration events:
  ```javascript
  socket.emit('backend:wall:penetrated', {
    wallIds: ['wall_123', 'wall_124'],
    positions: [{x: 100, y: 200}, {x: 105, y: 200}],
    remainingDamage: 60
  });
  ```

### Suppressed Pistol
**Action Required:**
- No special mechanics needed
- Just use lower damage value than regular pistol
- Frontend already handles quieter audio/visuals

## 3. Projectile Weapons

### Grenade Launcher
**Action Required:**
- Create projectile with type: `'grenadelauncher'`
- Arc trajectory with gravity (300 units/sec²)
- 3-second fuse timer
- Bounces off walls with 0.4 restitution
- Explodes on timer OR on direct player hit
- Explosion radius: 40 units
- Send standard projectile events

### Smoke Grenade
**Action Required:**
- Create projectile with type: `'smokegrenade'`
- 2-second fuse after throw
- On detonation:
  ```javascript
  // Create vision-blocking zone
  const smokeZone = {
    id: generateId(),
    position: detonationPos,
    radius: 60,
    duration: 10000, // 10 seconds
    type: 'smoke'
  };
  
  // Block vision rays passing through smoke
  // Update all affected players' vision polygons
  
  socket.emit('backend:smoke:deployed', {
    id: smokeZone.id,
    position: detonationPos,
    radius: 60
  });
  ```

### Flashbang
**Action Required:**
- Create projectile with type: `'flashbang'`
- 1.5-second fuse
- On detonation, check all players within 100 units:
  ```javascript
  const affected = [];
  for (const player of nearbyPlayers) {
    const distance = getDistance(player.position, detonationPos);
    if (distance < 100) {
      // Check if player is facing the flashbang
      const angleToFlash = Math.atan2(
        detonationPos.y - player.position.y,
        detonationPos.x - player.position.x
      );
      const angleDiff = Math.abs(player.rotation - angleToFlash);
      
      // More effect if looking at flash
      const facingMultiplier = angleDiff < Math.PI/2 ? 1.5 : 1.0;
      const intensity = (1 - distance/100) * facingMultiplier;
      
      affected.push({
        playerId: player.id,
        intensity: intensity,
        duration: 2000 * intensity // 0-2 seconds
      });
    }
  }
  
  socket.emit('backend:flashbang:detonated', {
    position: detonationPos,
    affected: affected
  });
  ```

## 4. Network Events to Implement

### New Outgoing Events

#### `weapon:heat:update`
```javascript
{
  weaponType: 'machinegun',
  heatLevel: 0-100,
  isOverheated: boolean
}
```

#### `backend:smoke:deployed`
```javascript
{
  id: string,
  position: {x, y},
  radius: number,
  duration: number
}
```

#### `backend:flashbang:detonated`
```javascript
{
  position: {x, y},
  affected: [{
    playerId: string,
    intensity: 0-1,
    duration: milliseconds
  }]
}
```

#### `backend:wall:penetrated`
```javascript
{
  wallIds: string[],
  positions: {x, y}[],
  remainingDamage: number
}
```

### Update Existing Events

#### `backend:projectile:created`
Must include projectile type for proper rendering:
```javascript
{
  id: string,
  type: 'grenade' | 'grenadelauncher' | 'smokegrenade' | 'flashbang' | 'rocket',
  position: {x, y},
  velocity: {x, y},
  ownerId: string
}
```

## 5. Weapon Validation

### Player Loadout Validation
**Action Required:**
- Validate weapon selections match frontend rules:
  - Only 1 primary weapon
  - Only 1 secondary weapon  
  - Support weapons use slot system (max 3 slots total)
  - Slot costs: grenade(1), smokegrenade(1), flashbang(1), grenadelauncher(2), machinegun(2), antimaterialrifle(2), rocket(3)

### Ammo Management
**Action Required:**
- Track ammo per weapon type per player
- Validate fire requests have ammo available
- Handle reload requests with proper timing
- Sync ammo counts in game state updates

### Fire Rate Limiting
**Action Required:**
- Enforce weapon RPM limits server-side:
  ```javascript
  const WEAPON_RPM = {
    rifle: 600,
    smg: 900,
    shotgun: 70,
    battlerifle: 450,
    sniperrifle: 40,
    pistol: 450,
    revolver: 150,
    suppressedpistol: 450,
    grenadelauncher: 60,
    machinegun: 800,
    antimaterialrifle: 30,
    rocket: 30
  };
  ```

## 6. Implementation Priority

### Phase 1 - Basic Functionality (Required)
1. Add magazine sizes and reload times
2. Update ammo tracking for all weapons
3. Implement shotgun spread pattern
4. Support projectile types in events

### Phase 2 - Special Mechanics (Recommended)
1. Machine gun overheating
2. Smoke grenade vision blocking
3. Flashbang effects
4. Anti-material rifle penetration

### Phase 3 - Polish (Optional)
1. Weapon-specific accuracy patterns
2. Damage falloff curves
3. Advanced reload mechanics (shotgun shell-by-shell)
4. Weapon sway/recoil patterns

## Testing Checklist
- [ ] All weapons fire with correct rate limits
- [ ] Reload times match configuration
- [ ] Ammo counts sync properly
- [ ] Shotgun fires 8 pellets with spread
- [ ] Projectiles render with correct types
- [ ] Support weapon slot validation works
- [ ] Special effects trigger (smoke, flash, penetration)
- [ ] No ammo exploits possible
- [ ] Network events include all required data

## Notes
- Frontend expects all damage calculations from backend
- Frontend will NOT wait for server confirmation for immediate feedback (muzzle flash, sounds)
- Bullet trails show actual hit positions from backend, not client predictions
- All thrown weapons use charge level (1-5 for grenades, always 1 for smoke/flash) 