# Partial Visibility - Visual Example

## Before Implementation (Current)
```
┌─────────────────────┐
│                     │
│  ┌────┐   👤       │  ← Entire player visible/invisible
│  │WALL│            │    (binary visibility)
│  │    │            │
│  └────┘            │
│                    │
│    👁️ (You)        │
└─────────────────────┘
```

## After Implementation
```
┌─────────────────────┐
│                     │
│  ┌────┐   👤       │  ← Only shoulder/arm visible
│  │WALL│  /         │    (partial occlusion)
│  │    │            │
│  └────┘            │
│                    │
│    👁️ (You)        │
└─────────────────────┘
```

## How It Works

### 1. Backend Sends Visibility Polygon
```javascript
vision: {
  polygon: [
    {x: 100, y: 100}, // Your position
    {x: 150, y: 80},  // Top edge of vision
    {x: 180, y: 100}, // Hits wall corner
    {x: 180, y: 120}, // Follows wall edge
    {x: 150, y: 140}, // Bottom edge
    {x: 100, y: 100}  // Back to start
  ]
}
```

### 2. Frontend Uses Polygon as Clip Mask
```javascript
// Step 1: Set polygon as clipping region
ctx.beginPath();
ctx.moveTo(100, 100);
ctx.lineTo(150, 80);
ctx.lineTo(180, 100);
ctx.lineTo(180, 120);
ctx.lineTo(150, 140);
ctx.closePath();
ctx.clip();

// Step 2: Draw player (only visible parts show)
drawPlayer(enemyPlayer);

// Step 3: Remove clipping
ctx.restore();
```

## Common Scenarios

### Peeking Around Corner
```
Before:              After:
┌────┐              ┌────┐
│    │   👤         │    │   👁
│    │              │    │  /
└────┘              └────┘
  👁️                  👁️

Player invisible    Only head visible
```

### Behind Destructible Wall
```
Initial:            Wall Damaged:       Wall Destroyed:
┌────┐              ┌─╱╲─┐              
│████│   👤         │█  █│   👤              👤
│████│              │█  █│  / \         
└────┘              └────┘              
  👁️                  👁️                  👁️

Not visible         Partially visible   Fully visible
```

### Multiple Players Behind Cover
```
┌──────────┐
│          │    👤 ← Only this player's 
│          │   /     shoulder visible
│          │  👤  ← This player hidden
│          │ /
└──────────┘
     👁️
```

## Implementation Preview

```javascript
// Minimal working example
function renderPlayersWithOcclusion(ctx, gameState) {
  const visionPolygon = gameState.vision.polygon;
  
  // For each enemy player
  for (const player of Object.values(gameState.players)) {
    if (player.id === myId) continue;
    
    // Save context state
    ctx.save();
    
    // Create clipping mask from vision polygon
    ctx.beginPath();
    visionPolygon.forEach((point, i) => {
      if (i === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    });
    ctx.closePath();
    ctx.clip();
    
    // Draw player - only visible parts will render!
    ctx.drawImage(playerSprite, player.x - 16, player.y - 16);
    
    // Restore context (removes clipping)
    ctx.restore();
  }
}
```

## Benefits

1. **Tactical Gameplay**: Can peek corners, use cover effectively
2. **Visual Feedback**: See exactly what you can/can't shoot
3. **No Extra Network Traffic**: Uses existing visibility data
4. **Performance**: Canvas clipping is GPU-accelerated

## Testing the Implementation

1. Stand behind a wall edge - you should see partial players
2. Rotate view - clipping should update smoothly
3. Destroy walls - visibility should expand correctly
4. Move around corners - smooth reveal/hide transitions 