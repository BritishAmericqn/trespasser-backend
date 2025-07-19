# Weapon System Debugging Plan - Step by Step

## What We Need to Find Out

1. Are weapons being equipped properly?
2. Are fire events reaching the backend?
3. Are we sending the right response events?
4. Is the frontend receiving our events?

## Step 1: Check Server Logs (MOST IMPORTANT)

### How to do it:
1. **Terminal 1** - Start the server:
   ```
   npm start
   ```
   
2. **WATCH THIS TERMINAL** - This is where you'll see what's happening

3. When you connect from the game, you should see:
   ```
   🎮 [PLAYER CREATED] socket-id-here
      No default weapons - waiting for weapon:equip event from frontend
   ```

### What to look for:
- Do you see "No default weapons" when you connect?
- Do you see "Equipping weapons" when you select your loadout?
- Do you see "WEAPON LOOKUP" when you fire?

## Step 2: Test with Browser Console

### How to do it:
1. Open your game in Chrome/Firefox
2. Press **F12** to open Developer Tools
3. Click on the **Console** tab
4. Type this EXACTLY and press Enter:

```javascript
// First, check if you're connected
console.log('Socket connected:', socket.connected);
```

If it says `true`, continue:

```javascript
// Now equip weapons
socket.emit('weapon:equip', {
  primary: 'rifle',
  secondary: 'pistol',
  support: ['grenade']
});
```

5. **CHECK THE SERVER TERMINAL** - Do you see:
   ```
   🎯 Equipping weapons for socket-id: primary=rifle, secondary=pistol, support=[grenade]
   ✅ Equipped primary: rifle
   ✅ Equipped secondary: pistol
   ✅ Equipped support: grenade
   ```

## Step 3: Test Firing

### In the browser console, type:

```javascript
// Listen for responses
socket.on('weapon:hit', (data) => console.log('HIT!', data));
socket.on('weapon:miss', (data) => console.log('MISS!', data));
socket.on('weapon:fired', (data) => console.log('FIRED!', data));

// Now fire the weapon
socket.emit('weapon:fire', {
  weaponType: 'rifle',
  position: {x: 240, y: 135},
  targetPosition: {x: 300, y: 135},
  direction: 0,
  isADS: false,
  timestamp: Date.now(),
  sequence: 1
});
```

### Check BOTH places:
1. **Browser Console** - Should show "FIRED!" and either "HIT!" or "MISS!"
2. **Server Terminal** - Should show weapon lookup logs

## Step 4: If Nothing Happens

Tell me EXACTLY what you see:
1. What shows in the server terminal?
2. What shows in the browser console?
3. Any error messages?

## Common Issues and Fixes

### Issue: "Socket is not defined"
The frontend might use a different variable name. Try:
- `window.socket`
- `game.socket`
- `client.socket`

### Issue: No server logs
Make sure you're looking at the right terminal window where you ran `npm start`

### Issue: "Weapon not found"
The weapon wasn't equipped. Make sure you run the equip command first.

## What I Need From You

Please do Steps 1-3 and tell me:
1. **Copy/paste what the server terminal shows**
2. **Copy/paste what the browser console shows**
3. **Tell me at which step things stop working**

Don't worry about understanding the logs - just copy them and I'll figure out what's wrong! 