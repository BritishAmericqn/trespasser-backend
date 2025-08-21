# 🔴 URGENT: Frontend Input Validation Issue

**Status:** Inputs reaching backend but being REJECTED  
**Error:** "Invalid input from player"  
**Impact:** All player inputs ignored, causing rubber-banding

## 🎯 THE PROBLEM

Your `player:input` events ARE reaching the backend (auth fix worked!) but are being **rejected during validation**.

## 📋 REQUIRED InputState Structure

The frontend MUST send this EXACT structure:

```typescript
{
  keys: {
    w: boolean,      // ALL keys must be present
    a: boolean,      // even if false
    s: boolean,
    d: boolean,
    shift: boolean,
    ctrl: boolean,
    r: boolean,
    g: boolean,
    '1': boolean,
    '2': boolean,
    '3': boolean,
    '4': boolean
  },
  mouse: {
    x: number,              // Game coordinates (0-480 or 0-1920)
    y: number,              // Game coordinates (0-270 or 0-1080)
    buttons: number,        // Must be 0-7
    leftPressed: boolean,
    rightPressed: boolean,
    leftReleased: boolean,
    rightReleased: boolean
  },
  sequence: number,         // MUST increment each frame
  timestamp: number         // MUST be Date.now()
}
```

## 🔍 Common Issues to Check

### 1. **Missing Fields**
```javascript
// BAD - Missing required fields
{
  keys: { w: true }, // Missing other keys!
  mouse: { x: 100, y: 100 } // Missing buttons, pressed states!
}

// GOOD - All fields present
{
  keys: { w: true, a: false, s: false, d: false, shift: false, ctrl: false, r: false, g: false, '1': false, '2': false, '3': false, '4': false },
  mouse: { x: 100, y: 100, buttons: 0, leftPressed: false, rightPressed: false, leftReleased: false, rightReleased: false },
  sequence: 1,
  timestamp: Date.now()
}
```

### 2. **Timestamp Issues**
```javascript
// BAD
timestamp: 0  // Not a real timestamp
timestamp: performance.now()  // Wrong time base

// GOOD
timestamp: Date.now()  // Correct!
```

### 3. **Mouse Coordinate Bounds**
The backend accepts EITHER:
- **Game space:** x: 0-480, y: 0-270
- **Screen space:** x: 0-1920, y: 0-1080

```javascript
// BAD
mouse: { x: -10, y: 2000 }  // Out of bounds!

// GOOD
mouse: { x: 240, y: 135 }   // Game space
mouse: { x: 960, y: 540 }   // Screen space
```

### 4. **Sequence Number**
```javascript
// BAD
sequence: 0  // Never incrementing
sequence: Math.random()  // Random!

// GOOD
let inputSequence = 0;
// In game loop:
inputSequence++;
inputState.sequence = inputSequence;
```

## 🔧 Debug Code for Frontend

Add this to see what you're sending:

```javascript
// Before emitting player:input
console.log('Sending InputState:', JSON.stringify(inputState, null, 2));

// Verify structure
const requiredKeys = ['keys', 'mouse', 'sequence', 'timestamp'];
const missingFields = requiredKeys.filter(key => inputState[key] === undefined);
if (missingFields.length > 0) {
  console.error('Missing fields:', missingFields);
}
```

## 📊 What Backend Logs Will Show

With debug enabled, Railway logs will now show:

```
❌ Malformed input: { hasInput: true, hasMouse: false, ... }
⏰ Input rejected: timestamp diff 5000ms
🔢 Input rejected: sequence 0 <= 100
🖱️ Input rejected: mouse out of bounds (2000, 3000)
```

## 🚀 Quick Fix Checklist

1. [ ] Verify ALL fields in InputState are present
2. [ ] Use `Date.now()` for timestamp
3. [ ] Increment sequence number each frame
4. [ ] Keep mouse coordinates in bounds
5. [ ] Send all keys even if false
6. [ ] Include all mouse button states

## 📝 Example Working Input

```javascript
const inputState = {
  keys: {
    w: keysPressed.w || false,
    a: keysPressed.a || false,
    s: keysPressed.s || false,
    d: keysPressed.d || false,
    shift: keysPressed.shift || false,
    ctrl: keysPressed.ctrl || false,
    r: keysPressed.r || false,
    g: keysPressed.g || false,
    '1': keysPressed['1'] || false,
    '2': keysPressed['2'] || false,
    '3': keysPressed['3'] || false,
    '4': keysPressed['4'] || false
  },
  mouse: {
    x: Math.min(Math.max(0, mouseX), 1920),  // Clamp to bounds
    y: Math.min(Math.max(0, mouseY), 1080),
    buttons: mouseButtons || 0,
    leftPressed: leftClick || false,
    rightPressed: rightClick || false,
    leftReleased: leftRelease || false,
    rightReleased: rightRelease || false
  },
  sequence: this.inputSequence++,
  timestamp: Date.now()
};

socket.emit('player:input', inputState);
```

---

**The backend now has detailed logging. Deploy is live. Check Railway logs to see EXACTLY which validation is failing!**
