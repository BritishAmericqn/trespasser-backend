# Backend Weapon Quick Reference

## All 15 Weapon Types (use exact names!)
```
Primary:   rifle, smg, shotgun, battlerifle, sniperrifle
Secondary: pistol, revolver, suppressedpistol  
Support:   grenade, smokegrenade, flashbang, grenadelauncher, rocket, machinegun, antimaterialrifle
```

## Incoming Events & Required Responses

### `weapon:fire` → Response depends on weapon type:

**Hitscan weapons** (rifle, smg, pistol, etc.):
- → `weapon:hit` OR `weapon:miss` OR `wall:damaged`

**Projectile weapons** (grenade, rocket, etc.):
- → `projectile:created` (immediately)
- → `projectile:updated` (every tick)
- → `projectile:exploded` (on impact)
- → `explosion:created` (damage effects)

**Special case - Shotgun**:
- Check for `pelletCount: 8`
- Fire 8 separate pellets with spread

### `weapon:switch` → `weapon:switched` (broadcast)
### `weapon:reload` → `weapon:reloaded` (after delay)
### `ads:toggle` → No response needed

## Critical Fields to Include

### In ALL responses:
- `weaponType` - MUST match exactly
- `playerId` - Who performed the action
- `position` - Where it happened

### For hit/damage events:
```javascript
{
  position: {x, y},      // Impact point
  weaponType: string,    // What weapon
  damage: number,        // How much damage
  // Plus specific fields for each event type
}
```

### For projectiles:
```javascript
{
  id: string,           // Unique projectile ID
  type: string,         // EXACT weapon name
  position: {x, y},     // Current position
  velocity: {x, y},     // Movement vector
  ownerId: string       // Who fired it
}
```

## Common Mistakes to Avoid

❌ DON'T use `rocketlauncher` → ✅ Use `rocket`
❌ DON'T forget `weaponType` in responses
❌ DON'T trust client damage values
❌ DON'T forget to broadcast events to all players
❌ DON'T send hit AND miss for same shot

## Testing Your Implementation

1. Install socket.io-client: `npm install socket.io-client`
2. Run the test script: `node BACKEND_WEAPON_TEST_SCRIPT.js`
3. Check that all 15 weapons show ✅ PASSED

## Magazine Sizes & Reload Times

```javascript
// Magazine sizes
rifle: 30, smg: 35, shotgun: 8, battlerifle: 20, sniperrifle: 5
pistol: 12, revolver: 6, suppressedpistol: 15
grenadelauncher: 6, machinegun: 100, antimaterialrifle: 5
grenade: 2, smokegrenade: 2, flashbang: 2, rocket: 1

// Reload times (ms)
rifle: 2500, smg: 2000, shotgun: 3500, battlerifle: 2800
sniperrifle: 3500, pistol: 1500, revolver: 3000
suppressedpistol: 1800, grenadelauncher: 4000
machinegun: 5000, antimaterialrifle: 4500, rocket: 3000
```

## Special Mechanics Summary

- **Shotgun**: 8 pellets, spread pattern
- **Machine Gun**: Heat system (0-100), overheat at 100
- **Anti-Material Rifle**: Penetrates up to 3 walls
- **Smoke Grenade**: Blocks vision for 10 seconds
- **Flashbang**: Affects players within 100 units
- **Grenades**: Use `chargeLevel` (1-5) for throw force 