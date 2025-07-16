# Frontend Partial Player Visibility Implementation Guide

## Overview

This guide helps the frontend team implement **partial player occlusion** - showing only the visible parts of players when they're partially behind walls. The backend already provides visibility polygon data; we'll use it to mask player sprites.

## Current System State

### What Backend Provides
```typescript
// In game state updates
vision: {
  type: 'polygon',
  polygon: Vector2[],        // Array of points forming visibility polygon
  viewAngle: number,         // 120° (2.094 radians)
  viewDirection: number,     // Player's looking direction
  viewDistance: number,      // 150px max vision range
  position: Vector2          // Viewer position
}
```

### Current Frontend Behavior
- Shows/hides entire players based on visibility
- Renders visibility polygon as green overlay
- No partial occlusion implemented

## Implementation Approach: Canvas Clipping

### Core Concept
Use the visibility polygon as a clipping mask when rendering other players. Only pixels inside the polygon will be visible.

### Step 1: Setup Clipping Context

```typescript
class VisibilityRenderer {
  private createClippingPath(ctx: CanvasRenderingContext2D, polygon: Vector2[]) {
    ctx.save();
    ctx.beginPath();
    
    // Move to first point
    ctx.moveTo(polygon[0].x, polygon[0].y);
    
    // Draw polygon
    for (let i = 1; i < polygon.length; i++) {
      ctx.lineTo(polygon[i].x, polygon[i].y);
    }
    
    ctx.closePath();
    ctx.clip(); // This makes the polygon a clipping mask
  }
  
  private restoreContext(ctx: CanvasRenderingContext2D) {
    ctx.restore(); // Removes clipping mask
  }
}
```

### Step 2: Render Players with Clipping

```typescript
renderPlayers(ctx: CanvasRenderingContext2D, gameState: GameState) {
  const myPlayerId = this.getMyPlayerId();
  const visionData = gameState.vision;
  
  // Render other players with visibility clipping
  for (const [playerId, player] of Object.entries(gameState.players)) {
    if (playerId === myPlayerId) continue; // Skip self
    
    // Apply clipping mask from visibility polygon
    this.createClippingPath(ctx, visionData.polygon);
    
    // Render player (only visible parts will show)
    this.renderPlayer(ctx, player);
    
    // Remove clipping mask
    this.restoreContext(ctx);
  }
  
  // Render self without clipping
  const myPlayer = gameState.players[myPlayerId];
  if (myPlayer) {
    this.renderPlayer(ctx, myPlayer);
  }
}
```

### Step 3: Smooth Edge Transitions (Optional Enhancement)

For better visual quality, add soft edges where players are clipped:

```typescript
private renderPlayerWithSoftEdges(ctx: CanvasRenderingContext2D, player: PlayerState, polygon: Vector2[]) {
  // Create off-screen canvas for player
  const offscreen = document.createElement('canvas');
  const offCtx = offscreen.getContext('2d')!;
  offscreen.width = ctx.canvas.width;
  offscreen.height = ctx.canvas.height;
  
  // Render player to offscreen canvas
  this.renderPlayer(offCtx, player);
  
  // Apply polygon as alpha mask with gradient edges
  offCtx.globalCompositeOperation = 'destination-in';
  
  // Create gradient along polygon edges
  const gradient = this.createEdgeGradient(offCtx, polygon, player.transform.position);
  offCtx.fillStyle = gradient;
  offCtx.fill();
  
  // Draw masked result to main canvas
  ctx.drawImage(offscreen, 0, 0);
}
```

## Implementation Steps

### Phase 1: Basic Clipping (1-2 hours)
1. **Modify player rendering loop** to check if player is not self
2. **Apply clipping path** before rendering each enemy player
3. **Test** with players partially behind walls

### Phase 2: Optimization (2-3 hours)
1. **Cache visibility polygon path** to avoid recreating each frame
2. **Spatial culling** - skip players far from visibility polygon
3. **Dirty rectangle tracking** - only redraw changed areas

### Phase 3: Visual Polish (Optional, 2-3 hours)
1. **Soft edges** at clipping boundaries
2. **Fade effect** for players at vision range limit
3. **Shadow hints** for partially visible players

## Code Integration Points

### 1. Main Game Renderer
```typescript
// In your main render loop
render(gameState: GameState) {
  // Clear canvas
  this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  
  // Render map/walls
  this.renderWalls(gameState.walls);
  
  // Render players with visibility masking
  this.renderPlayersWithVisibility(gameState);
  
  // Render effects, UI, etc.
  this.renderEffects();
}
```

### 2. Visibility System Integration
```typescript
class PlayerRenderer {
  renderPlayersWithVisibility(gameState: GameState) {
    const myId = this.getMyPlayerId();
    const vision = gameState.vision;
    
    if (!vision || vision.type !== 'polygon') {
      // Fallback to simple rendering
      this.renderAllPlayers(gameState.players);
      return;
    }
    
    // Render enemies with clipping
    for (const [id, player] of Object.entries(gameState.players)) {
      if (id === myId || !player.isAlive) continue;
      
      this.ctx.save();
      
      // Create clipping region from visibility polygon
      this.ctx.beginPath();
      this.ctx.moveTo(vision.polygon[0].x, vision.polygon[0].y);
      for (let i = 1; i < vision.polygon.length; i++) {
        this.ctx.lineTo(vision.polygon[i].x, vision.polygon[i].y);
      }
      this.ctx.closePath();
      this.ctx.clip();
      
      // Render player sprite
      this.renderPlayerSprite(player);
      
      this.ctx.restore();
    }
    
    // Render self
    const self = gameState.players[myId];
    if (self) this.renderPlayerSprite(self);
  }
}
```

## Performance Considerations

### Do's ✅
- Cache polygon paths when possible
- Use `ctx.save()/restore()` efficiently
- Implement view frustum culling
- Use layer compositing for complex scenes

### Don'ts ❌
- Don't create new canvases every frame
- Don't calculate polygon intersections in JS (let Canvas API handle it)
- Don't apply effects to players definitely outside view

## Testing Checklist

- [ ] Players fully behind walls are invisible
- [ ] Players partially behind walls show only visible parts
- [ ] Own player always renders fully
- [ ] No rendering artifacts at polygon edges
- [ ] Performance remains smooth with 8 players
- [ ] Clipping updates smoothly as player rotates
- [ ] Works correctly when walls are destroyed

## Advanced: WebGL Implementation

For even better performance, consider WebGL with stencil buffer:

```typescript
// Pseudocode for WebGL approach
class WebGLVisibilityRenderer {
  setupStencilBuffer(polygon: Vector2[]) {
    // Clear stencil buffer
    gl.clear(gl.STENCIL_BUFFER_BIT);
    
    // Draw polygon to stencil
    gl.stencilFunc(gl.ALWAYS, 1, 0xFF);
    gl.stencilOp(gl.KEEP, gl.KEEP, gl.REPLACE);
    this.drawPolygon(polygon);
    
    // Configure stencil test for players
    gl.stencilFunc(gl.EQUAL, 1, 0xFF);
    gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);
  }
}
```

## Debugging Tips

1. **Visualize the clipping region** temporarily:
```typescript
// Add after setting clip
ctx.strokeStyle = 'red';
ctx.lineWidth = 2;
ctx.stroke();
```

2. **Log polygon points** to ensure correct data:
```typescript
console.log('Visibility polygon:', vision.polygon);
```

3. **Test edge cases**:
   - Player exactly on polygon edge
   - Multiple players in same clipped area
   - Rapid rotation causing polygon updates

## Expected Result

When implemented correctly:
- Players behind walls show only their visible parts
- Smooth transitions as players move in/out of view
- No performance degradation
- Enhanced tactical gameplay - "peeking" becomes meaningful

## Questions for Frontend Team

1. Are you using Canvas 2D or WebGL for rendering?
2. Do you have existing sprite/animation systems to integrate with?
3. What's the current FPS target and player count?
4. Do you want soft edges or hard clipping?

---

**Note**: This implementation is purely visual. The backend remains authoritative for all gameplay mechanics (shooting, damage, etc.). Players cannot exploit client-side visibility to gain advantages. 