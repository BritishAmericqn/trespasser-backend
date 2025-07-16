# Grid-Aligned Vision Smoothing Approach

## Concept

If walls are aligned to the 8x8 grid, we can make assumptions that allow for efficient smoothing without complex calculations.

## Benefits of Grid Alignment

1. **Predictable edges** - We know exactly where wall boundaries are
2. **Simple neighbor checks** - Only need to check 8 adjacent tiles
3. **Pattern-based smoothing** - Can use lookup tables for common configurations
4. **Efficient implementation** - No floating-point calculations needed

## Implementation Strategy

### Step 1: Align Walls to Grid

```typescript
// Force wall positions to grid multiples
function alignToGrid(value: number, gridSize: number = 8): number {
    return Math.round(value / gridSize) * gridSize;
}

// When creating walls:
const alignedWall = {
    position: {
        x: alignToGrid(wall.position.x),
        y: alignToGrid(wall.position.y)
    },
    width: alignToGrid(wall.width),
    height: alignToGrid(wall.height)
};
```

### Step 2: Vision Edge Detection

```typescript
// After calculating visible tiles, find edges
function findVisionEdges(visibleTiles: Set<number>): Set<number> {
    const edges = new Set<number>();
    
    for (const tileIndex of visibleTiles) {
        const neighbors = getNeighborIndices(tileIndex);
        
        // If any neighbor is not visible, this is an edge tile
        for (const neighbor of neighbors) {
            if (!visibleTiles.has(neighbor)) {
                edges.add(tileIndex);
                break;
            }
        }
    }
    
    return edges;
}
```

### Step 3: Smoothing Patterns

```typescript
// Define smoothing patterns based on neighbor visibility
const SMOOTHING_PATTERNS = {
    // Outer corners (extend vision slightly)
    CORNER_NW: { pattern: 0b00000111, extension: [{x: -1, y: -1}] },
    CORNER_NE: { pattern: 0b00011100, extension: [{x: 1, y: -1}] },
    CORNER_SW: { pattern: 0b00111000, extension: [{x: -1, y: 1}] },
    CORNER_SE: { pattern: 0b11100000, extension: [{x: 1, y: 1}] },
    
    // Inner corners (cut vision slightly)
    INNER_NW: { pattern: 0b11111000, reduction: [{x: 0, y: 0}] },
    INNER_NE: { pattern: 0b11100011, reduction: [{x: 0, y: 0}] },
    
    // Straight edges (no change)
    EDGE_N: { pattern: 0b00011111, extension: [] },
    EDGE_S: { pattern: 0b11111000, extension: [] }
};

function applySmoothingPattern(tileIndex: number, neighborMask: number): number[] {
    // Check each pattern
    for (const [name, config] of Object.entries(SMOOTHING_PATTERNS)) {
        if ((neighborMask & config.pattern) === config.pattern) {
            // Apply the pattern's extension/reduction
            return config.extension || [];
        }
    }
    return [];
}
```

### Step 4: Sub-tile Resolution for Edges

```typescript
// For edge tiles, use 2x2 sub-tile resolution
interface SubTileVisibility {
    tileIndex: number;
    subTiles: boolean[]; // [NW, NE, SW, SE]
}

function calculateSubTileVisibility(
    edgeTile: number, 
    visibleTiles: Set<number>,
    wallTiles: Set<number>
): SubTileVisibility {
    const result: SubTileVisibility = {
        tileIndex: edgeTile,
        subTiles: [true, true, true, true]
    };
    
    // Check each quadrant's visibility based on neighbors
    const tile = indexToTile(edgeTile);
    
    // Northwest quadrant
    if (wallTiles.has(tileToIndex(tile.x - 1, tile.y)) ||
        wallTiles.has(tileToIndex(tile.x, tile.y - 1))) {
        result.subTiles[0] = false;
    }
    
    // Similar for other quadrants...
    
    return result;
}
```

## Visual Examples

### Before Smoothing (8x8 tiles)
```
█ █ █ █ █
█ · · · █
█ · P · █  (P = player, · = visible, █ = not visible)
█ · · · █
█ █ █ █ █
```

### After Smoothing (with sub-tiles)
```
█ ▓ ▓ ▓ █
▓ · · · ▓
▓ · P · ▓  (▓ = partially visible edge)
▓ · · · ▓
█ ▓ ▓ ▓ █
```

## Implementation Plan

1. **Backend Changes**:
   - Align all walls to 8x8 grid
   - Add edge detection to vision system
   - Include sub-tile data for edge tiles

2. **Data Format**:
   ```typescript
   interface EnhancedVisionData {
       visibleTiles: number[];        // Full tiles
       edgeTiles: SubTileVisibility[]; // Edge tiles with sub-tile data
   }
   ```

3. **Frontend Rendering**:
   - Render full tiles normally
   - Render edge tiles with partial transparency
   - Use smooth gradients for transitions

## Performance Impact

- **Minimal overhead**: Only process ~100-200 edge tiles
- **No complex math**: All integer operations
- **Cacheable patterns**: Can pre-compute common scenarios
- **Still uses indices**: Maintains bandwidth efficiency

## Recommendation

This approach offers a good balance:
- **Quick to implement** (2-3 hours)
- **Looks much better** than pure tile-based
- **Maintains performance** advantages
- **Compatible with destruction** system

For holes/gaps between walls, the sub-tile resolution will naturally handle them better than the current system. 