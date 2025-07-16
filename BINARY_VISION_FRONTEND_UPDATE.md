# Binary Vision System - Frontend Update Required

**BREAKING CHANGE**: The backend vision system now uses numeric indices instead of string coordinates.

## What Changed

### Before (String-based):
```typescript
visibleTiles: ["15,8", "16,8", "17,8", ...]  // "x,y" strings
```

### After (Index-based):
```typescript  
visibleTiles: [255, 256, 257, ...]  // Single number indices
```

## Grid Dimensions

**UPDATE**: Tile size changed from 16x16 to 8x8 pixels for better vision granularity.

- Grid: 60×34 tiles (was 30×17)
- Tile size: 8×8 pixels (was 16×16)
- Game area: 480×270 pixels
- Formula: `index = y * 60 + x`

## How to Convert Indices to Coordinates

Each tile index represents a position in a 60×34 grid.

The conversion formula is:
- **Index to Coordinates**: 
  - `x = index % 60`
  - `y = Math.floor(index / 60)`
- **Coordinates to Index**: 
  - `index = y * 60 + x`

### Example Implementation

```javascript
// Constants
const TILE_SIZE = 8;     // Changed from 16
const GRID_WIDTH = 60;   // 480 / 8
const GRID_HEIGHT = 34;  // 272 / 8 (covers full height)

// Convert tile index to pixel coordinates
function tileIndexToPixels(index) {
  const tileX = index % GRID_WIDTH;
  const tileY = Math.floor(index / GRID_WIDTH);
  
  return {
    x: tileX * TILE_SIZE,
    y: tileY * TILE_SIZE
  };
}

// Convert tile index to tile coordinates
function indexToTile(index) {
  return {
    x: index % GRID_WIDTH,
    y: Math.floor(index / GRID_WIDTH)
  };
}

// Example: Process vision data
socket.on('game:state', (state) => {
  if (state.vision && state.vision.visibleTiles) {
    // Clear fog for visible tiles
    for (const tileIndex of state.vision.visibleTiles) {
      const pixelPos = tileIndexToPixels(tileIndex);
      
      // Clear fog at this tile (example)
      clearFogAt(pixelPos.x, pixelPos.y, TILE_SIZE, TILE_SIZE);
    }
  }
});
```

## Performance Benefits

1. **67% Bandwidth Reduction**: From ~6 bytes per tile to 2 bytes
2. **Zero String Allocations**: No more garbage collection pressure
3. **Faster Processing**: Numeric operations are much faster than string parsing
4. **Direct TypedArray Support**: Can be efficiently packed into binary formats

## Implementation Checklist

- [ ] Update the `GameState` type definition to use `number[]` for `visibleTiles`
- [ ] Replace any string parsing logic (e.g., `tile.split(',')`) with index conversions
- [ ] Update fog rendering to use the tile index format
- [ ] Test that fog of war still works correctly
- [ ] Consider caching the tile-to-pixel conversions if needed

## Migration Example

### Before (String-based)
```javascript
function processVisibleTiles(tiles) {
  for (const tileStr of tiles) {
    const [x, y] = tileStr.split(',').map(Number);
    const pixelX = x * 8;
    const pixelY = y * 8;
    clearFogAt(pixelX, pixelY);
  }
}
```

### After (Index-based)
```javascript
function processVisibleTiles(tileIndices) {
  for (const index of tileIndices) {
    const x = index % 60;
    const y = Math.floor(index / 60);
    const pixelX = x * 8;
    const pixelY = y * 8;
    clearFogAt(pixelX, pixelY);
  }
}
```

## Testing

You can verify the new format is working by:

1. Checking that `state.vision.visibleTiles` contains numbers, not strings
2. Verifying indices are in range [0, 2039] (60×34-1)
3. Confirming fog of war clears correctly for visible areas

## Questions?

If you have any questions about the new format or need help with the implementation, please reach out!

## Technical Details

- Grid dimensions: 60×34 tiles (covers 480×272 pixels)
- Tile size: 8×8 pixels (improved from 16×16)
- Max index value: 2039 (0-indexed)
- Data type: 16-bit unsigned integers (though sent as regular numbers in JSON) 