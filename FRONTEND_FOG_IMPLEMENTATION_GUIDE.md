# 🌫️ Frontend Fog of War Implementation Guide

## The Problem

The backend is correctly calculating and sending vision data, but the frontend is not rendering fog of war. You can see through walls even though the backend says you shouldn't!

## What Backend Sends

In every `game:state` event, you receive:

```javascript
{
  players: { ... },
  projectiles: [ ... ],
  walls: { ... },
  vision: {
    visiblePixels: ["240,135", "241,135", ...], // Array of "x,y" strings
    viewAngle: 1.5708,  // Player's looking direction in radians
    position: { x: 240, y: 135 }  // Player's position
  }
}
```

## Implementation Steps

### 1. Create Fog Layer

```javascript
// Create a canvas for fog overlay
const fogCanvas = document.createElement('canvas');
fogCanvas.width = 480;
fogCanvas.height = 270;
const fogCtx = fogCanvas.getContext('2d');

// Set fog to cover everything
fogCtx.fillStyle = 'rgba(0, 0, 0, 0.8)'; // 80% black fog
fogCtx.fillRect(0, 0, 480, 270);
```

### 2. Clear Visible Areas

```javascript
socket.on('game:state', (state) => {
  if (!state.vision) return;
  
  // Reset fog
  fogCtx.fillStyle = 'rgba(0, 0, 0, 0.8)';
  fogCtx.fillRect(0, 0, 480, 270);
  
  // Convert visible pixels to Set for fast lookup
  const visibleSet = new Set(state.vision.visiblePixels);
  
  // Clear fog for visible pixels
  fogCtx.globalCompositeOperation = 'destination-out';
  
  // Method 1: Pixel-by-pixel (accurate but slow)
  for (const pixelStr of state.vision.visiblePixels) {
    const [x, y] = pixelStr.split(',').map(Number);
    fogCtx.fillRect(x, y, 1, 1);
  }
  
  // Method 2: Optimized with chunks (faster)
  // Group adjacent pixels and clear in blocks
  
  fogCtx.globalCompositeOperation = 'source-over';
});
```

### 3. Render Fog Over Game

```javascript
// In your render loop
function render() {
  // 1. Draw game world
  drawMap();
  drawWalls();
  drawPlayers();
  
  // 2. Draw fog on top
  mainCtx.drawImage(fogCanvas, 0, 0);
  
  // 3. Optional: Draw UI on top of fog
  drawUI();
}
```

### 4. Optimize with Dirty Rectangles

```javascript
let lastVisiblePixels = new Set();

socket.on('game:state', (state) => {
  const currentVisible = new Set(state.vision.visiblePixels);
  
  // Only update fog if vision changed
  if (!setsEqual(lastVisiblePixels, currentVisible)) {
    updateFog(currentVisible);
    lastVisiblePixels = currentVisible;
  }
});
```

### 5. Smooth Fog Edges (Optional)

```javascript
// After clearing visible pixels, blur the edges
function smoothFogEdges() {
  // Apply gaussian blur to fog canvas
  fogCtx.filter = 'blur(2px)';
  fogCtx.drawImage(fogCanvas, 0, 0);
  fogCtx.filter = 'none';
}
```

## Important Notes

1. **Performance**: With ~7000 visible pixels, updating every frame can be expensive. Consider:
   - Only update when vision changes
   - Use WebGL for better performance
   - Group pixels into larger rectangles

2. **Visual Quality**: 
   - Add slight blur to fog edges for smoother look
   - Consider gradient fog (darker further from player)
   - Maybe add "last seen" ghost images

3. **Debugging**:
   ```javascript
   // Draw vision cone outline for debugging
   if (DEBUG_MODE) {
     ctx.strokeStyle = 'yellow';
     ctx.beginPath();
     // Draw vision cone based on state.vision.viewAngle
   }
   ```

## Example: Minimal Implementation

```javascript
// Fog system
class FogOfWar {
  constructor(width, height) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx = this.canvas.getContext('2d');
  }
  
  update(visiblePixels) {
    // Fill with fog
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Clear visible areas
    this.ctx.globalCompositeOperation = 'destination-out';
    
    // Convert to pixel coordinates and clear
    for (const pixelStr of visiblePixels) {
      const [x, y] = pixelStr.split(',').map(Number);
      this.ctx.fillRect(x, y, 1, 1);
    }
    
    this.ctx.globalCompositeOperation = 'source-over';
  }
  
  render(targetCtx) {
    targetCtx.drawImage(this.canvas, 0, 0);
  }
}

// Usage
const fog = new FogOfWar(480, 270);

socket.on('game:state', (state) => {
  if (state.vision) {
    fog.update(state.vision.visiblePixels);
  }
});

// In render loop
function render() {
  // Draw game
  drawGame();
  
  // Draw fog on top
  fog.render(ctx);
}
```

## Testing Your Implementation

1. Stand next to a wall - you should NOT see through it
2. Destroy wall slices - you SHOULD see through destroyed parts
3. Turn around - fog should update with your view direction
4. Move around - fog should reveal new areas

## Backend Verification

The backend vision is working correctly. You can verify by checking:
- Walls block vision (intact walls have destructionMask: [0,0,0,0,0])
- Vision cone is ~120° forward + 30px peripheral
- Extended vision in mouse direction

If you're still seeing through walls after implementing this, the issue is in the frontend rendering, not the backend vision calculation! 