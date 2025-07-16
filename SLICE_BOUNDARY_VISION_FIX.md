# Slice Boundary Vision Fix (Polygon System)

## Problem
When shooting parallel to a wall through a destroyed slice, players could see all the way down the wall instead of being limited to the "window" created by the destroyed slice. This was because rays would enter through a destroyed slice and continue traveling without hitting any boundaries.

## Visual Example
```
Before (WRONG):
╔═══╦═══╦═══╦═══╦═══╗
║███║   ║███║███║███║  <- Wall with slice 1 destroyed
╚═══╩═══╩═══╩═══╩═══╝
     ↓
     └─────────────────→ Ray travels along entire wall

After (CORRECT):
╔═══╦═══╦═══╦═══╦═══╗
║███║   ║███║███║███║  <- Wall with slice 1 destroyed
╚═══╩═══╩═══╩═══╩═══╝
     ↓
     └→|                Ray hits slice boundary
```

## Root Cause
The VisibilityPolygonSystem's `castRay` method was too simplistic. When it detected a ray passing through a destroyed slice, it would completely ignore that wall and continue checking other walls. This allowed rays to travel through walls indefinitely.

## Solution
Completely rewrote the ray casting logic in VisibilityPolygonSystem:

### 1. VisibilityPolygonSystem (`castRay`)
- Now checks which specific slice a ray hits when it intersects a wall
- If it hits a destroyed slice, calls new `checkSliceBoundaries` method
- This method steps along the ray path inside the wall to find slice boundaries

### 2. VisibilityPolygonSystem (`checkSliceBoundaries`)
- Efficiently checks all vertical slice boundaries (0-5)
- Identifies boundaries between destroyed and intact slices
- Calculates ray intersection with each boundary
- Returns the closest hit point where ray would hit an intact slice
- Also checks if ray exits the wall through an intact slice

### 3. WeaponSystem (`raycast`)
- Collects ALL wall intersections along the ray path
- Sorts hits by distance to process in order
- When hitting a destroyed slice, continues ray to check walls behind it
- Only stops when hitting an intact slice or reaching max distance
- Allows shooting through destroyed slices to hit walls/slices behind them

## Technical Details

### Key Changes:
```typescript
// TileVisionSystem - Check next position for slice transitions
if (Math.abs(dx) > 0.01) { // Ray has horizontal component
    const nextSliceIndex = Math.floor(nextRelativeX / sliceWidth);
    if (nextSliceIndex !== sliceIndex && !nextSliceDestroyed) {
        break; // Hit intact slice boundary
    }
}

// VisibilityPolygonSystem - Sample multiple points
for (let i = 0; i <= numChecks; i++) {
    // Check each point along ray path
    if (!sliceDestroyed) return false;
}

// WeaponSystem - Continue checking after destroyed slice
if (wall.destructionMask[wallHit.sliceIndex] === 1) {
    // Check for hits on adjacent intact slices
}
```

## Benefits
1. **Realistic Vision**: Players can only see through the actual destroyed area
2. **Tactical Gameplay**: Creating multiple peek holes requires destroying multiple slices
3. **Consistent Physics**: Vision, shooting, and movement all respect the same boundaries
4. **Better Strategy**: Can't exploit single destroyed slice to see/shoot along entire wall

## Key Implementation Details

The solution works by treating slice boundaries as virtual walls:
- When a ray enters through a destroyed slice, we check all slice boundaries
- If a boundary separates a destroyed slice from an intact slice, it acts like a wall edge
- The visibility polygon algorithm already handles these edges by casting rays to corners

## Testing
1. Destroy middle slice of a wall
2. Stand to the side and look parallel to the wall
3. Vision should be limited to the destroyed slice area
4. Shooting parallel should hit the next intact slice, not travel indefinitely

## Performance Optimizations
- Direct boundary calculation instead of stepping along ray (O(5) vs O(1000))
- Only checks boundaries that could potentially block the ray
- Reuses existing corner generation for polygon vertices 