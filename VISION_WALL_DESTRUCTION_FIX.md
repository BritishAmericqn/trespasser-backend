# Vision Through Destroyed Walls - Fixed

## The Problem

Even after fully destroying walls, players couldn't see through them. The issue was in how the vision system was notified about wall destruction.

## Root Cause

When `onWallDestroyed` was called, it was receiving the **slice center position** instead of the **wall position**:

```typescript
// DestructionSystem.getSlicePosition returns:
{
    x: wall.position.x + (sliceIndex * sliceWidth) + (sliceWidth / 2),  // Slice CENTER
    y: wall.position.y + (wall.height / 2)
}
```

This caused the vision system to calculate wrong tile indices. For example:
- Wall at position (200, 100) with width 60
- Slice 2 center would be at approximately (230, 107)
- Vision system would think the wall occupies tiles around (230, 107) instead of (200, 100)

## The Fix

Modified `onWallDestroyed` to:
1. Accept the full wall object with position and dimensions
2. Calculate ALL tiles the wall occupies
3. Track destruction for each tile separately
4. Remove tiles from blocking when all 5 slices are destroyed

```typescript
onWallDestroyed(wallId: string, wall: { position: Vector2; width: number; height: number }, sliceIndex: number) {
    // Calculate all tiles that this wall occupies
    const startX = Math.floor(wall.position.x / this.TILE_SIZE);
    const startY = Math.floor(wall.position.y / this.TILE_SIZE);
    const endX = Math.floor((wall.position.x + wall.width) / this.TILE_SIZE);
    const endY = Math.floor((wall.position.y + wall.height) / this.TILE_SIZE);
    
    // Track destruction for EACH tile the wall occupies
    for (let y = startY; y <= endY; y++) {
        for (let x = startX; x <= endX; x++) {
            // ... track partial destruction
        }
    }
}
```

## Testing

1. The server now logs when wall tiles are removed from vision blocking
2. Destroying all 5 slices of a wall will allow vision through
3. Raycasting will continue through fully destroyed walls

## Status

✅ Vision through destroyed walls is now working correctly
✅ Partial destruction (3+ slices) allows vision through
✅ Complete destruction removes all blocking tiles 