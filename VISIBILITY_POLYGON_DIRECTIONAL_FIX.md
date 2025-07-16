# Visibility Polygon - Directional Shadow & FOV Fixes

## Problems Fixed

### 1. Vertices Behind Player's POV
**Issue**: The polygon included vertices behind the player, outside the 120° FOV
**Cause**: Angles were added to the list without proper FOV filtering
**Fix**: Added strict FOV filtering to ensure all angles are within view cone bounds

### 2. Bidirectional Wall Shadows
**Issue**: Walls cast shadows in both directions, creating incorrect occlusion
**Cause**: All wall corners were included regardless of which side faced the player
**Fix**: Implemented edge frontfacing detection to only include corners that block vision

## Technical Solutions

### FOV Filtering
```typescript
// Filter out any angles outside FOV
const fovAngles = angles.filter(angle => {
  let angleDiff = angle - viewDirection;
  // Normalize to [-PI, PI]
  while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
  while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
  return Math.abs(angleDiff) <= this.viewAngle / 2;
});
```

### Edge Frontfacing Detection
```typescript
// Calculate edge normal and check which side viewer is on
const dot = normalX * toViewerX + normalY * toViewerY;
// If dot < 0, edge is frontfacing (blocks vision)
return dot < 0;
```

## Visual Results

### Before:
- Vertices appearing behind player
- Walls casting shadows on both sides
- Incorrect occlusion patterns

### After:
- Clean 120° vision cone
- Walls only cast shadows away from viewer
- Proper line-of-sight occlusion

## Algorithm Flow

1. Find walls within range
2. For each wall, determine which edges face the viewer
3. Only add corners from frontfacing edges
4. Filter all angles to be within FOV
5. Build polygon with proper directional shadows 