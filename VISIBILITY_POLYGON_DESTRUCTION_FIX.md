# Visibility Polygon Destruction Tracking Fix

## Issues Found and Fixed

### 1. Wall ID Mismatch
**Problem**: Wall IDs weren't preserved when initializing the visibility system
- DestructionSystem uses: `wall_1`, `wall_2`, etc.
- VisibilityPolygonSystem was creating: `wall_0`, `wall_1` based on array index
- Result: `onWallDestroyed` couldn't find walls

**Fix**: Now preserving wall IDs from destruction system
```typescript
// Before: wallData.forEach((wall, index) => { id: `wall_${index}` })
// After: wallData.forEach((wall) => { id: wall.id })
```

### 2. Incorrect Corner Generation
**Problem**: Logic for adding corners at destruction boundaries was flawed
- Only checked some transitions
- Had condition `i === 4` that was too restrictive

**Fix**: Now checks all boundaries between slices (0-5)
```typescript
// Check each boundary between slices
for (let i = 0; i <= 5; i++) {
  // Compare left and right slice states
  if (leftDestroyed !== rightDestroyed) {
    // Add corner at transition
  }
}
```

### 3. Only Handled Horizontal Walls
**Problem**: `rayPassesThroughDestroyedSlice` only worked for horizontal walls
```typescript
// Before: if (wall.width > wall.height) { ... }
```

**Fix**: Now handles all walls since slices are always vertical divisions

### 4. Debug Logging Added
Now logs:
- When slices are destroyed with binary mask visualization
- When destruction corners are added to walls
- Warnings if wall IDs don't match

## Expected Behavior

### Correct Vision Through Destroyed Slices
- Destroying slice 2 creates vision ONLY through that 1/5 of the wall
- Adjacent intact slices still block vision
- Multiple destroyed slices create multiple sight lines

### Corner Generation
For a wall with slices [intact, destroyed, intact, intact, destroyed]:
- Mask: `10010` (binary, right-to-left)
- Creates corners at boundaries: slice 1-2, slice 2-3, slice 4-5
- Total: 6 new corners (top and bottom at each transition)

### Testing
Watch the console logs:
```
[VisibilityPolygon] Wall wall_3 slice 2 destroyed. Mask: 00000 → 00100
[VisibilityPolygon] Wall wall_3 (mask: 00100) added 4 destruction corners
```

## Remaining Considerations

1. **Performance**: More corners = more rays to cast
2. **Edge Cases**: Fully destroyed walls (mask: 11111) skip corner generation
3. **Vertical Walls**: All walls work the same way (5 vertical slices) 