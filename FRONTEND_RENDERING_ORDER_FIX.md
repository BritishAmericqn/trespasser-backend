# 🎨 Frontend Rendering Order Fix

## The Problem

You've implemented fog of war, but walls are visible through the fog even though the backend says they shouldn't be visible. This is a **rendering order issue**.

## What's Happening

Your current rendering order is likely:
1. Draw background/floor
2. Draw fog overlay (using vision.visiblePixels)
3. Draw walls on top ❌
4. Draw players/effects

This makes walls visible regardless of fog!

## The Fix

### Option 1: Mask Everything (Recommended)

```javascript
// Create off-screen canvas for game world
const gameCanvas = document.createElement('canvas');
const gameCtx = gameCanvas.getContext('2d');

// In render loop:
function render() {
  // 1. Draw EVERYTHING to gameCanvas first
  gameCtx.clearRect(0, 0, 480, 270);
  drawFloor(gameCtx);
  drawWalls(gameCtx);      // Draw ALL walls here
  drawPlayers(gameCtx);    // Draw other players
  drawEffects(gameCtx);
  
  // 2. Clear main canvas
  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, 480, 270);
  
  // 3. Draw only visible pixels from gameCanvas
  const visibleSet = new Set(gameState.vision.visiblePixels);
  
  // Method A: Pixel by pixel (accurate but slow)
  for (const pixelStr of gameState.vision.visiblePixels) {
    const [x, y] = pixelStr.split(',').map(Number);
    // Copy single pixel from game canvas to main canvas
    ctx.drawImage(gameCanvas, x, y, 1, 1, x, y, 1, 1);
  }
  
  // 4. Draw local player on top (always visible)
  drawLocalPlayer(ctx);
  
  // 5. Draw UI elements
  drawUI(ctx);
}
```

### Option 2: Selective Wall Drawing

```javascript
function render() {
  // 1. Draw background
  drawFloor(ctx);
  
  // 2. Draw ONLY visible walls
  const visibleSet = new Set(gameState.vision.visiblePixels);
  
  for (const [wallId, wall] of Object.entries(gameState.walls)) {
    // Check if ANY part of wall is visible
    let wallVisible = false;
    
    for (let x = wall.position.x; x < wall.position.x + wall.width; x++) {
      for (let y = wall.position.y; y < wall.position.y + wall.height; y++) {
        if (visibleSet.has(`${x},${y}`)) {
          wallVisible = true;
          break;
        }
      }
      if (wallVisible) break;
    }
    
    // Only draw if visible
    if (wallVisible) {
      drawWall(ctx, wall);
    }
  }
  
  // 3. Draw fog overlay for aesthetics (optional)
  drawFogEdges(ctx);
  
  // 4. Draw players and effects
  drawPlayers(ctx);
}
```

### Option 3: Fog Overlay with Proper Masking

```javascript
// Keep your current fog implementation but ensure walls are drawn BEFORE fog
function render() {
  // 1. Draw everything first
  drawFloor(ctx);
  drawWalls(ctx);     // ALL walls
  drawPlayers(ctx);
  
  // 2. Apply fog mask on top
  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(fogCanvas, 0, 0); // Your fog canvas with holes for visible areas
  ctx.globalCompositeOperation = 'source-over';
  
  // 3. Draw black background behind everything
  ctx.globalCompositeOperation = 'destination-over';
  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, 480, 270);
  ctx.globalCompositeOperation = 'source-over';
}
```

## Quick Test

To verify this is the issue:
1. Temporarily skip drawing walls in your render loop
2. If walls disappear from fog areas, rendering order is the problem
3. If walls still show through fog, there's another issue

## Performance Tips

- Option 2 is fastest (only draw visible walls)
- Option 1 is most accurate (pixel-perfect masking)
- Option 3 is easiest to implement with your current fog system

## Expected Result

After fixing, walls should:
- ✅ Be invisible in black fog areas
- ✅ Only appear when in visible pixels
- ✅ Properly occlude vision behind them 