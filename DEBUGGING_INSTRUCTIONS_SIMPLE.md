# How to Debug the Weapon System - SIMPLE VERSION

## Step 1: Open the Debug Helper

1. **Open a new terminal** (Command+T on Mac or Ctrl+T on Windows/Linux)
2. Navigate to the project:
   ```
   cd /Users/benjaminroyston/trespasser-backend
   ```
3. Type this command:
   ```
   open debug-helper.html
   ```
   (On Windows use: `start debug-helper.html`)

This will open a webpage that helps test weapons.

## Step 2: Start the Server

1. **Open another terminal** (Command+T or Ctrl+T)
2. Navigate to the project:
   ```
   cd /Users/benjaminroyston/trespasser-backend
   ```
3. Start the server:
   ```
   npm start
   ```
4. **KEEP THIS TERMINAL VISIBLE** - You'll see important messages here

## Step 3: Use the Debug Helper

In the webpage that opened:

1. Click **"Connect to Server"**
   - You should see "✅ Connected!" in green
   - The server terminal should show player creation

2. Click **"Equip: Rifle + Pistol + Grenade"**
   - You should see weapon equipped messages
   - The server terminal should show equip messages

3. Click **"Fire Rifle"**
   - You should see either HIT or MISS messages
   - The server terminal should show weapon lookup

## What to Tell Me

Take a screenshot or copy/paste:
1. What the debug helper webpage shows
2. What the server terminal shows

## If Something Doesn't Work

### "Page won't open"
Your browser might block local files. Instead:
1. In terminal: `python3 -m http.server 8000`
2. Open browser to: http://localhost:8000/debug-helper.html

### "Can't connect"
Make sure the server is running (npm start)

### "No weapons equipped"
The weapon:equip event isn't working - tell me what the server shows

## Alternative: Test in Your Game

If the debug helper works but your game doesn't:
1. Open your game
2. Press F12 for console
3. Type: `console.log(socket)` or `console.log(window.socket)`
4. Tell me what it shows

The issue is likely that your game isn't sending the `weapon:equip` event when you select weapons. 