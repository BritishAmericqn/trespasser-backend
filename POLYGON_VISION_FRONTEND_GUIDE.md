# Polygon-Based Vision System - Frontend Implementation Guide

## Overview

We've upgraded from a tile-based vision system to a polygon-based system that provides pixel-perfect, sharp vision boundaries. Instead of receiving thousands of tile indices, you'll now receive a compact visibility polygon.

## Benefits

- **Pixel-perfect boundaries** - No more 8x8 tile artifacts
- **90% less data** - ~400 bytes instead of ~7KB
- **Sharper visuals** - Clean geometric edges at walls
- **Better performance** - Fewer calculations on both ends

## Data Format

When `vision.type === 'polygon'`, you'll receive:

```typescript
{
  type: 'polygon',
  polygon: Vector2[],      // Array of {x, y} vertices
  viewAngle: number,       // FOV angle in radians (e.g., 2.094 for 120°)
  viewDirection: number,   // Player's facing direction in radians
  viewDistance: number,    // Maximum view distance in pixels
  position: Vector2        // Player position
}
```

## Implementation Example

```javascript
// 1. Create a clipping mask from the polygon
function createVisionMask(ctx, visionData) {
  ctx.save();
  ctx.beginPath();
  
  // Move to first vertex
  ctx.moveTo(visionData.polygon[0].x, visionData.polygon[0].y);
  
  // Draw lines to each vertex
  for (let i = 1; i < visionData.polygon.length; i++) {
    ctx.lineTo(visionData.polygon[i].x, visionData.polygon[i].y);
  }
  
  // Close the path
  ctx.closePath();
  ctx.clip();
  
  // Now anything drawn will only appear within the polygon
}

// 2. Render with the mask
function renderWithVision(ctx, gameState) {
  if (gameState.vision?.type === 'polygon') {
    // Apply vision mask
    createVisionMask(ctx, gameState.vision);
    
    // Draw game world (only visible parts will show)
    drawTerrain(ctx);
    drawWalls(ctx);
    drawPlayers(ctx);
    drawProjectiles(ctx);
    
    ctx.restore(); // Remove clipping
    
    // Draw fog outside vision
    drawFogOfWar(ctx, gameState.vision);
  }
}

// 3. Draw fog of war (optional)
function drawFogOfWar(ctx, visionData) {
  ctx.save();
  
  // Fill entire screen with fog
  ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
  ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  
  // Cut out the visible area
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.moveTo(visionData.polygon[0].x, visionData.polygon[0].y);
  visionData.polygon.forEach(vertex => {
    ctx.lineTo(vertex.x, vertex.y);
  });
  ctx.closePath();
  ctx.fill();
  
  ctx.restore();
}
```

## Fallback Support

The system still supports tile-based vision for compatibility:

```javascript
if (gameState.vision?.type === 'tiles') {
  // Use old tile-based rendering
  renderTileBasedVision(ctx, gameState.vision.visibleTiles);
} else if (gameState.vision?.type === 'polygon') {
  // Use new polygon-based rendering
  renderPolygonVision(ctx, gameState.vision);
}
```

## Visual Examples

### Before (Tile-Based)
- Chunky 8x8 pixel blocks
- Staircase artifacts on diagonal walls
- Vision "leaks" at corners

### After (Polygon-Based)
- Smooth edges aligned with walls
- Natural shadows past corners
- Precise vision through destroyed walls

## Performance Tips

1. **Cache the polygon path** if player hasn't moved
2. **Use hardware acceleration** with CSS transforms
3. **Consider WebGL** for even better performance
4. **Batch render operations** inside the clipped region

## Testing

To switch between systems for comparison:
- Backend sets `usePolygonVision = true/false`
- Frontend checks `vision.type` field
- Both systems remain compatible

## Questions?

The polygon vertices are ordered clockwise and form a closed shape. The visibility calculation already accounts for:
- Wall occlusion
- Destroyed wall segments
- 120° vision cone
- Maximum view distance

You should see immediate visual improvements with sharper, cleaner vision boundaries! 