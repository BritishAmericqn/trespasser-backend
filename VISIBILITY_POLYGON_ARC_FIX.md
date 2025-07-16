# Visibility Polygon Arc Segment Fix

## Problem

When there were few or no wall corners in the field of view, the visibility polygon would create straight lines (secants) between sparse points, cutting off large areas that should be visible.

### Examples:
1. **Single corner**: Straight lines from corner to FOV edges created triangular cutoff
2. **No corners in direction**: Direct line from left to right FOV boundary (chord across the arc)

## Root Cause

The original algorithm only cast rays at:
- Left FOV boundary
- Wall corners (with epsilon offsets)
- Right FOV boundary

This created a polygon with straight edges between these points. When angular gaps were large (no corners for 60°+), the straight lines would cut across the vision arc.

## Solution

Add intermediate arc points when angular gaps exceed 10 degrees:

```typescript
const maxAngleGap = Math.PI / 18; // 10 degrees

// If gap between points > 10°, add arc points
if (angleGap > maxAngleGap) {
  const numIntermediatePoints = Math.ceil(angleGap / maxAngleGap);
  // Add points along the arc at max view distance
}
```

## Algorithm Flow

1. Collect all angles (boundaries + corners)
2. Sort angles in ascending order
3. Iterate through angles, checking gaps
4. When gap > 10°, add intermediate arc points
5. Cast rays at all points (original + intermediate)

## Visual Result

### Before:
```
     corner
    /     \    <- straight lines (secants)
   /       \
player------
```

### After:
```
     corner
    ╱ ‥ ‥ ╲    <- smooth arc with intermediate points
   ╱ ‥   ‥ ╲
player------
```

## Benefits

- Smooth vision cone edges
- No more triangular cutoffs
- Proper arc following FOV angle
- Works with any corner configuration
- Minimal performance impact (only adds points where needed) 