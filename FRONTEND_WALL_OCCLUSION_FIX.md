# 🧱 Frontend Wall Occlusion Fix

## The Problem

The backend IS correctly calculating wall occlusion, but the frontend isn't using the vision data to render the fog properly. Walls should block vision, but currently they don't.

## How Backend Vision Works

The backend sends each player their `visiblePixels` as part of the game state:

```typescript
// In game:state event
{
  players: { ... },
  walls: { 
    wall_1: {
      position: { x: 200, y: 100 },
      width: 60,
      height: 15,
      destructionMask: [0, 0, 0, 0, 0], // 0=intact, 1=destroyed
      // ...
    }
  },
  // NO visiblePixels here! Need to implement vision data transmission
}
```

## The Issue: Vision Data Not Sent!

Looking at the code, the backend calculates vision but **doesn't include it in the game state**! The `visiblePixels` Set is calculated but never sent to clients.

## Backend Fix Required

Add vision data to `getFilteredGameState`:

```typescript
// In GameStateSystem.ts
getFilteredGameState(playerId: string): GameState {
  const visionState = this.playerVisionStates.get(playerId);
  // ...
  
  return {
    players: visiblePlayersObject as any,
    projectiles: visibleProjectiles,
    walls: wallsObject as any,
    timestamp: Date.now(),
    tickRate: GAME_CONFIG.TICK_RATE,
    // ADD THIS:
    vision: {
      visiblePixels: Array.from(visionState.visiblePixels), // Convert Set to Array
      viewAngle: visionState.viewAngle,
      position: visionState.lastPosition
    }
  };
}
```

## Frontend Implementation

Once the backend sends vision data:

### 1. Create Fog Texture
```typescript
// Create a black texture for fog
const fogTexture = new PIXI.RenderTexture.create({
  width: 480,
  height: 270
});

// Fill with black (fog)
const fogGraphics = new PIXI.Graphics();
fogGraphics.beginFill(0x000000);
fogGraphics.drawRect(0, 0, 480, 270);
fogGraphics.endFill();
```

### 2. Cut Out Visible Areas
```typescript
socket.on('game:state', (state) => {
  if (state.vision && state.vision.visiblePixels) {
    // Clear previous visibility
    fogGraphics.clear();
    fogGraphics.beginFill(0x000000);
    fogGraphics.drawRect(0, 0, 480, 270);
    fogGraphics.endFill();
    
    // Cut out visible pixels
    fogGraphics.blendMode = PIXI.BLEND_MODES.ERASE;
    fogGraphics.beginFill(0xFFFFFF);
    
    for (const pixelStr of state.vision.visiblePixels) {
      const [x, y] = pixelStr.split(',').map(Number);
      fogGraphics.drawRect(x, y, 1, 1);
    }
    
    fogGraphics.endFill();
  }
});
```

### 3. Smooth the Edges (Optional)
Instead of 1x1 pixel cuts, group adjacent pixels:

```typescript
// Group visible pixels into larger rectangles
const visibleRects = groupPixelsIntoRectangles(state.vision.visiblePixels);

for (const rect of visibleRects) {
  fogGraphics.drawRect(rect.x, rect.y, rect.width, rect.height);
}
```

### 4. Apply as Mask or Overlay
```typescript
// Option 1: As overlay
const fogSprite = new PIXI.Sprite(fogTexture);
fogSprite.alpha = 0.9; // Slight transparency
gameContainer.addChild(fogSprite);

// Option 2: As mask (cleaner but harder edges)
gameContainer.mask = fogSprite;
```

## Testing Wall Occlusion

1. Run the backend: `npm start`
2. Run test: `node test-wall-occlusion.js`
3. Press '1' to position players on opposite sides of a wall
4. Players should NOT see each other
5. Press '2' to destroy the wall
6. Players should now see each other

## Summary

1. **Backend vision calculation works** ✅
2. **Vision data not sent to frontend** ❌
3. **Need to add `vision` field to game state** 🔧
4. **Frontend must use vision data to render fog** 🎨 