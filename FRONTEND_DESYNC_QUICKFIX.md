# 🚨 URGENT: Frontend Position Desync Fix

## The Issue
Fog of war is broken because player positions are desynced between client and server.

## Quick Fix Checklist

### ✅ 1. Match These Exact Constants
```typescript
const TICK_RATE = 60;                    // 60 Hz
const PLAYER_SPEED_WALK = 100;          // pixels per second
const PLAYER_SPEED_RUN = 150;           // shift key (1.5x)
const PLAYER_SPEED_SNEAK = 50;          // ctrl key (0.5x)
const DELTA_TIME = 1000 / TICK_RATE;    // 16.67ms
```

### ✅ 2. Send Input EVERY Frame (60Hz)
```typescript
// Run this 60 times per second, NOT just when keys change!
setInterval(() => {
  socket.emit('player:input', {
    keys: { w, a, s, d },
    mouse: { x: mouseX, y: mouseY },  // Game coords (0-480, 0-270)
    shift: shiftPressed,
    ctrl: ctrlPressed,
    timestamp: Date.now(),
    sequence: inputSequence++
  });
}, 16.67);
```

### ✅ 3. Use Server's lastProcessedInput
```typescript
socket.on('game:state', (state) => {
  const myPlayer = state.players[socketId];
  const serverPos = myPlayer.transform.position;
  const lastProcessed = myPlayer.lastProcessedInput; // ← USE THIS!
  
  // Remove inputs that server already processed
  pendingInputs = pendingInputs.filter(i => i.sequence > lastProcessed);
});
```

### ✅ 4. Match Movement Math EXACTLY
```typescript
// Backend does this:
const deltaSeconds = 16.67 / 1000;  // 0.01667
position.x += direction.x * speed * deltaSeconds;

// So frontend MUST do:
const deltaSeconds = 16.67 / 1000;  // NOT deltaTime from frame!
localPos.x += moveDir.x * speed * deltaSeconds;
```

### ✅ 5. Reconcile with Server Position
```typescript
// When server update arrives:
if (distance(serverPos, localPos) > 2) {
  // Snap to server position
  localPos = { ...serverPos };
  
  // Re-apply unprocessed inputs
  for (const input of pendingInputs) {
    applyMovement(input);
  }
}
```

## ⚠️ Common Bugs

### ❌ Using Variable Delta Time
```typescript
// WRONG - This causes desync!
const deltaTime = performance.now() - lastFrame;
position.x += speed * (deltaTime / 1000);

// CORRECT - Use fixed timestep
const deltaSeconds = 16.67 / 1000;
position.x += speed * deltaSeconds;
```

### ❌ Only Sending Input on Change
```typescript
// WRONG - Server needs continuous input
if (keysChanged) socket.emit('player:input', ...);

// CORRECT - Send every frame
setInterval(() => socket.emit('player:input', ...), 16.67);
```

### ❌ Wrong Mouse Coordinates
```typescript
// WRONG - Screen coordinates
mouse: { x: event.clientX, y: event.clientY }

// CORRECT - Game space (0-480, 0-270)
mouse: { x: mouseX / scale, y: mouseY / scale }
```

## 🧪 Test Your Fix

1. Move in circles for 10 seconds
2. Position should stay synced within 2 pixels
3. No jittering or teleporting
4. Fog of war updates correctly

## 💡 Remember

The server is authoritative. Your job is to:
1. Predict movement locally for smooth gameplay
2. Reconcile with server updates when they arrive
3. Use the EXACT same math as the backend 