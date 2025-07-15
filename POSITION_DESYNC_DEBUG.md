# 🔍 Position Desync Debug Plan

## Changes Made to Backend

I've added extensive debugging to help identify the position desync issue. Here's what's now logged:

### 1. **Player Spawn Logging**
```javascript
🎮 PLAYER SPAWNED: [id] at (240, 135)
```
- Confirms initial position is (240, 135) as expected

### 2. **Periodic Position Checks** (every 1 second)
```javascript
📍 POSITION CHECK [id]: (x, y) | vel: (vx, vy) | state: [movement state]
```
- Shows current server position, velocity, and movement state

### 3. **Input Processing**
```javascript
🎮 INPUT [id] seq:[n] | before: (x, y) → after: (x, y) | keys: w,a,s,d
```
- Tracks position changes from each input
- Shows which keys were pressed
- Includes sequence number for tracking dropped inputs

### 4. **Movement Calculations** (5% sample rate)
```javascript
🏃 MOVEMENT CALC [id]:
   Input: w,d
   Movement vector: (1, -1)
   Speed: base=100, modifier=1, final=100
   Delta: time=16.67ms, seconds=0.01667
   Position delta: (1.1785, -1.1785)
```
- Shows exact movement math
- Verifies delta time calculations

### 5. **Weapon Fire Position Check**
```javascript
🎯 POSITION CHECK for [id]:
   Client sent: (335.74, 64.29)
   Server has:  (313.63, 71.36)
   Offset:      (-22.11, 7.07)
```
- Shows exact mismatch when weapons fire
- Helps identify if offset is consistent

### 6. **Input Validation Warnings**
```javascript
⏰ Input rejected: timestamp diff 1500ms
🔢 Input rejected: sequence 100 <= 150
🖱️ Input rejected: mouse out of bounds (2000, 1500)
```
- Shows if inputs are being rejected

## Key Fixes Applied

### 1. **More Lenient Input Validation**
- Now accepts both game space (0-480, 0-270) and screen space (0-1920, 0-1080) mouse coordinates
- Allows some out-of-order packets (up to 10 sequence numbers back)

### 2. **Fixed Angle Calculation** 
- Removed incorrect SCALE_FACTOR multiplication in rotation calculation
- Mouse coordinates now treated as game space

## Debug Test Script

I've created `debug_position_sync.js` to test position synchronization:

```bash
node debug_position_sync.js
```

This script:
1. Connects as a player
2. Moves right for 1 second (D key held)
3. Stops and fires a weapon
4. Shows position updates and any mismatch

## What Frontend Should Check

### 1. **Initial Position**
```javascript
// Frontend should start player at:
position: { x: 240, y: 135 }  // Center of 480x270
```

### 2. **Movement Calculation**
```javascript
// Frontend should use EXACT same formula:
const deltaTime = 16.67; // ms per frame at 60Hz
const deltaSeconds = deltaTime / 1000;
position.x += velocity.x * deltaSeconds;
```

### 3. **Input Events**
```javascript
// Ensure sending at 60Hz with:
{
  keys: { w, a, s, d, shift, ctrl },
  mouse: { x, y, buttons },  // x,y in game space (0-480, 0-270)
  sequence: incrementing number,
  timestamp: Date.now()
}
```

### 4. **Speed Constants**
```javascript
PLAYER_SPEED_WALK: 100    // pixels per second
PLAYER_SPEED_RUN: 150     // shift key
PLAYER_SPEED_SNEAK: 50    // ctrl key
```

## Possible Causes of Desync

1. **Different Frame Rates**: Frontend at 60Hz, backend at 60Hz physics but position might update differently
2. **Accumulated Float Errors**: Small differences compound over time
3. **Dropped Inputs**: Network issues causing some inputs to be lost
4. **Initial Position Mismatch**: Player might spawn at different location
5. **Speed/Delta Calculation**: Different formula for applying movement

## Next Steps

1. **Run the backend** with new debugging: `npm run dev`
2. **Connect frontend** and move around
3. **Check console** for position logs
4. **Compare** frontend displayed position with server logs
5. **Look for patterns** in the offset values

The extensive logging should help us identify exactly where the positions diverge! 