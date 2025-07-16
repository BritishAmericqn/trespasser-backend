# Vision System - Current Status

## Recent Fixes & Improvements

### 1. ✅ Raycasting Implementation
- 60 rays cast in 120° cone
- Smoother, more accurate vision
- Better gap detection

### 2. ✅ Tile Size Reduction: 16×16 → 8×8
- 4x better resolution (60×34 grid)
- Less blocky appearance
- Better gap visibility

### 3. ✅ Any Slice Destruction Allows Vision
- Changed from requiring 60% destruction
- Single destroyed slice creates peek hole
- More realistic and tactical

### 4. ✅ Wall Position Fix
- Fixed `onWallDestroyed` using slice center instead of wall position
- Properly tracks all tiles a wall occupies
- Correctly removes tiles when fully destroyed

### 5. ✅ Hitscan Notification Fix (LATEST)
- Vision system now notified for rifle/pistol hits
- Previously only worked for explosions
- Critical bug that prevented vision through rifle-damaged walls

## How It Works Now

1. **Wall Initialization**: All walls added to `wallTileIndices`
2. **Damage Tracking**: When ANY slice is damaged, `onWallDestroyed` is called
3. **Partial Destruction**: Each tile tracks which slices are destroyed (bitmask)
4. **Vision Check**: If a tile has ANY destroyed slices, rays pass through
5. **Full Destruction**: When all 5 slices destroyed, tile removed from blocking

## Debugging

The system now logs:
- `🔍 onWallDestroyed called for wall_X slice Y` - When damage occurs
- `Wall occupies tiles from (X,Y) to (X,Y)` - Tile coverage
- `Tile X,Y: destroyed slices BINARY` - Destruction tracking
- `✅ Wall tile X,Y fully destroyed` - Complete destruction
- `Ray passing through damaged wall` - Vision working

## Frontend Requirements

- Handle 60×34 grid (8×8 tiles)
- Use numeric tile indices
- Update fog based on `visibleTiles` array

## Known Working Features

- ✅ See through any destroyed slice
- ✅ Rifle/pistol damage updates vision
- ✅ Rocket/explosion damage updates vision  
- ✅ Fully destroyed walls removed from blocking
- ✅ Raycasting provides smooth vision cones 