# 🚨 CRITICAL: Frontend Must Use Backend Vision Data

## The Problem

The frontend is showing a massive vision cone that goes through walls, but the backend is sending correct vision data with proper wall occlusion. The frontend is NOT using the backend's vision data.

## What Backend Sends (CONFIRMED WORKING ✅)

Every `game:state` event includes:

```javascript
{
  players: { ... },
  walls: { ... },
  vision: {
    visiblePixels: ["240,135", "241,135", ...], // ~2800 pixel coordinates
    viewAngle: 0.0,               // Player's looking angle in radians
    position: { x: 240, y: 135 }  // Player position
  }
}
```

### Vision Characteristics:
- **Range**: ~100 pixels (extends to about 149x52 pixel area)
- **Shape**: 120° cone forward + 30px peripheral + extended mouse direction
- **Wall blocking**: Working correctly - can't see through walls
- **Update rate**: 20Hz (every 50ms)

## Frontend MUST Do This

### 1. STOP Using Your Own Vision Calculation

If you have code like this, REMOVE IT:
```javascript
// ❌ WRONG - Don't calculate vision yourself!
function calculateVision(player) {
  const visionRadius = 200; // Way too big!
  // Draw circle or cone...
}
```

### 2. USE the Backend's visiblePixels

```javascript
socket.on('game:state', (state) => {
  if (!state.vision || !state.vision.visiblePixels) {
    console.error('No vision data from backend!');
    return;
  }
  
  // state.vision.visiblePixels is an array of "x,y" strings
  // These are the ONLY pixels the player can see!
  updateFog(state.vision.visiblePixels);
});
```

### 3. Implement Proper Fog Rendering

```javascript
function updateFog(visiblePixels) {
  // Option A: Pixel-perfect (most accurate)
  // Clear everything to black
  fogCtx.fillStyle = 'black';
  fogCtx.fillRect(0, 0, 480, 270);
  
  // Only show visible pixels
  fogCtx.fillStyle = 'transparent';
  for (const pixelStr of visiblePixels) {
    const [x, y] = pixelStr.split(',').map(Number);
    fogCtx.clearRect(x, y, 1, 1);
  }
  
  // Option B: Grouped rectangles (better performance)
  const visibleSet = new Set(visiblePixels);
  // Group adjacent pixels into rectangles...
}
```

### 4. Test It's Working

1. Stand next to a wall - you should NOT see past it
2. The vision cone should be ~100 pixels, not 200+
3. Vision should match the ~2800 pixels the backend sends

## Common Mistakes to Avoid

### ❌ Don't Do This:
```javascript
// Using your own vision range
const VISION_RANGE = 200;

// Drawing your own vision cone
drawVisionCone(player.x, player.y, player.angle);

// Calculating line of sight yourself
if (distanceTo(target) < VISION_RANGE) { ... }
```

### ✅ Do This Instead:
```javascript
// Only use what backend tells you
const visibleSet = new Set(state.vision.visiblePixels);

// Check if something is visible
if (visibleSet.has(`${x},${y}`)) {
  // It's visible
}
```

## Debug Helper

Add this to see what you're receiving:
```javascript
socket.on('game:state', (state) => {
  if (state.vision) {
    console.log('Vision pixels:', state.vision.visiblePixels.length);
    console.log('First 5 pixels:', state.vision.visiblePixels.slice(0, 5));
  }
});
```

You should see ~2800 pixels, not 10000+!

## The Fix in 3 Steps

1. **Find** where you're drawing vision/fog
2. **Replace** your vision calculation with `state.vision.visiblePixels`
3. **Test** that vision stops at walls

Remember: The backend is authoritative for vision. Your job is just to display what the backend says is visible! 