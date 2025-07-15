# 📐 Important: Player Rotation Updates

## How Rotation Works Now

### Backend Behavior
1. **Player rotation is updated with EVERY input event** via `player:input`
2. Rotation is calculated as: `atan2(mouse.y - player.y, mouse.x - player.x)`
3. When firing, backend uses its stored `player.transform.rotation`
4. Frontend's `direction` in weapon:fire is now IGNORED

### What Frontend Must Do

#### 1. **Send Mouse Position with Every Input** ✅
```javascript
// Send input at 60Hz or whenever mouse moves significantly
socket.emit('player:input', {
  keys: { w: false, a: true, s: false, d: false },
  mouse: { x: mouseX, y: mouseY },  // CRITICAL: Must be current!
  sequence: inputSequence++,
  timestamp: Date.now()
});
```

#### 2. **Mouse Coordinates Must Be Game Space** ✅
- Range: x: 0-480, y: 0-270
- NOT screen pixels (1920x1080)
- Backend uses these directly for angle calculation

#### 3. **Update Frequency Matters** ⚠️
- If you only send input when keys change → rotation won't update while moving!
- Send input on BOTH:
  - Key state changes
  - Mouse movement (throttled to 60Hz)
  - OR: Send at fixed 60Hz regardless

## Example Scenario

**Without Proper Updates:**
1. Player holds 'D' key (moving right)
2. No new input sent (keys didn't change)
3. Player rotation stays the same
4. Firing angle is wrong! ❌

**With Proper Updates:**
1. Player holds 'D' key (moving right)
2. Input sent every frame with current mouse position
3. Backend recalculates rotation each frame
4. Firing angle updates correctly! ✅

## Quick Test
```javascript
// Add this debug to your input loop
console.log('Sending input:', {
  mousePos: { x: mouse.x, y: mouse.y },
  playerPos: { x: player.x, y: player.y },
  expectedAngle: Math.atan2(mouse.y - player.y, mouse.x - player.x) * 180 / Math.PI
});
```

Then check if backend's rotation matches your expected angle!

## TL;DR
- Send mouse position with EVERY input (even if keys don't change)
- Use game coordinates (0-480, 0-270)
- Backend handles all rotation calculations
- Your `direction` in weapon:fire is now ignored 