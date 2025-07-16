# 👁️ Vision System Scanline Fix

## Issue Found

The scanline algorithm in `VisionSystem.calculateMainVision()` had a bug that could allow vision to "leak" past walls in certain scenarios.

### The Problem

The original algorithm would:
1. Scan left until hitting a wall or FOV edge
2. Scan right until hitting a wall or FOV edge  
3. Add the ENTIRE scanned segment to the next scanline

This meant if a wall only partially blocked a scanline, the next row would still try to scan the full width, potentially seeing past the wall.

## The Fix

Modified the scanline algorithm to properly handle walls by processing segments:

```typescript
// Process the scanline in segments to handle walls properly
let currentX = segment.x1;

while (currentX <= segment.x2) {
    // Skip past any walls at current position
    while (currentX <= segment.x2 && 
           this.isWallBlocking(currentX, y, walls)) {
        currentX++;
    }
    
    if (currentX > segment.x2) break;
    
    // Found start of a visible segment
    let segmentStart = currentX;
    let segmentEnd = currentX;
    
    // Scan this visible segment...
    // Add only this segment to next scanline, not the full width
}
```

## Test Results

After the fix:
- ✅ Walls properly block vision in all tested scenarios
- ✅ No vision "leaking" past walls
- ✅ Correct handling of partial wall coverage
- ✅ Performance remains excellent

## Important Note

Some pixels that appear to be "behind" walls may still be legitimately visible if:
- They're above/below the wall (walls have specific heights)
- There's a clear diagonal path around the wall
- The wall has been partially destroyed

The vision system works on a pixel-perfect basis and will show any pixel that has an unobstructed path from the player. 