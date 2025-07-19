# Frontend Integration Guide - Making Weapons Work

## The Problem

The backend weapon system is working, but your frontend needs to tell the backend what weapons the player has selected.

## The Solution

### When a player selects their loadout (REQUIRED):

```javascript
// Example: After player selects weapons in your UI
function onLoadoutConfirmed() {
    // Get the selected weapons from your UI
    const primary = getSelectedPrimaryWeapon();    // e.g., 'rifle'
    const secondary = getSelectedSecondaryWeapon(); // e.g., 'pistol'
    const support = getSelectedSupportWeapons();    // e.g., ['grenade', 'rocket']
    
    // Tell the backend what weapons to give the player
    socket.emit('weapon:equip', {
        primary: primary,
        secondary: secondary,
        support: support
    });
}
```

### Listen for confirmation:

```javascript
// Add this to know when weapons are ready
socket.on('weapon:equipped', (data) => {
    console.log('Weapons equipped:', data.weapons);
    console.log('Current weapon:', data.currentWeapon);
    // Now the player can fire weapons!
});
```

## Common Integration Points

### 1. In your weapon selection menu:
```javascript
// When player clicks "Start Game" or "Confirm Loadout"
onStartGame() {
    socket.emit('weapon:equip', {
        primary: this.selectedPrimary,
        secondary: this.selectedSecondary,
        support: this.selectedSupport
    });
}
```

### 2. On respawn:
```javascript
// When player respawns, re-equip their weapons
onPlayerRespawn() {
    socket.emit('weapon:equip', {
        primary: this.playerLoadout.primary,
        secondary: this.playerLoadout.secondary,
        support: this.playerLoadout.support
    });
}
```

### 3. For testing/development:
```javascript
// Add a debug command to manually equip weapons
if (debugMode) {
    window.equipTestWeapons = () => {
        socket.emit('weapon:equip', {
            primary: 'rifle',
            secondary: 'pistol',
            support: ['grenade', 'rocket']
        });
    };
}
```

## Why This Is Required

- Players spawn with NO weapons
- Backend doesn't know what weapons the player selected
- Without `weapon:equip`, firing any weapon will fail

## Testing Your Integration

1. Add console logging:
```javascript
// Before sending
console.log('Sending weapon:equip with:', loadout);
socket.emit('weapon:equip', loadout);

// Listen for response
socket.on('weapon:equipped', (data) => {
    console.log('Backend confirmed weapons:', data);
});
```

2. Check server logs for:
```
🎯 Equipping weapons for socket-id: primary=rifle, secondary=pistol, support=[grenade,rocket]
✅ Equipped primary: rifle
✅ Equipped secondary: pistol
✅ Equipped support: grenade
✅ Equipped support: rocket
```

## Quick Fix to Test

In your browser console while in game:
```javascript
// This will immediately give you weapons
socket.emit('weapon:equip', {
    primary: 'rifle',
    secondary: 'revolver',
    support: ['grenade', 'rocket']
});
```

Then try firing - it should work!

## Remember

Every time a player needs weapons (game start, respawn, etc.), you MUST send `weapon:equip`! 