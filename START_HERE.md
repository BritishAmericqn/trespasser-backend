# 🚨 START HERE - Weapon Debugging Guide

I understand you're frustrated. Let's figure this out together, step by step.

## Quick Test First (2 minutes)

### Terminal 1:
```bash
cd /Users/benjaminroyston/trespasser-backend
npm start
```

### Terminal 2:
```bash
cd /Users/benjaminroyston/trespasser-backend
node quick-weapon-check.js
```

### What should happen:
You should see:
```
✅ Test 1 PASSED: Connected to server
✅ Test 2 PASSED: Authenticated
✅ Test 3 PASSED: Player spawned
✅ Test 4 PASSED: Weapons equipped
✅ Test 5 PASSED: Weapon fired event received
✅ Test 6 PASSED: Weapon hit/miss event received

🎉 WEAPONS ARE WORKING!
```

## If the Quick Test Works

The backend is fine! The issue is that your game isn't sending the `weapon:equip` event.

### Fix for your game:
When players select their weapons in your game's UI, make sure it runs:
```javascript
socket.emit('weapon:equip', {
    primary: selectedPrimaryWeapon,
    secondary: selectedSecondaryWeapon,
    support: selectedSupportWeapons
});
```

## If the Quick Test Fails

Tell me:
1. How many tests passed? (e.g., "3 out of 6")
2. What error messages you see
3. Copy what Terminal 1 (server) shows

## Visual Debugging Option

If you prefer clicking buttons:
1. Open `debug-helper.html` in your browser
2. Click "Connect to Server"
3. Click "Equip: Rifle + Pistol + Grenade"
4. Click "Fire Rifle"
5. Tell me what shows up in the event log

## The Most Common Issue

**Your game probably isn't sending `weapon:equip`!**

To check:
1. Open your game
2. Press F12 for console
3. Before selecting weapons, type:
   ```javascript
   socket.on('weapon:equipped', (data) => console.log('EQUIPPED!', data));
   ```
4. Now select your weapons in the game
5. If you don't see "EQUIPPED!" in the console, that's the problem

## I'm Here to Help

Run the quick test and tell me:
- What test number it stops at
- Any error messages
- What the server terminal shows

We'll get this working! 