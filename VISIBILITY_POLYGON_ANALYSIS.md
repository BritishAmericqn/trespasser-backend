# Visibility Polygon Analysis - Research Findings

## The Core Problem

We're implementing a **limited FOV visibility polygon** (angle and distance bounded), which is fundamentally harder than 360° visibility because:

1. The vision boundary is a **sector** (2 radii + 1 arc), not just rays to corners
2. We need to seamlessly integrate arc segments with wall-based polygon edges
3. Not all corner vertices are relevant (only those within the FOV)

## Our Current Issues

### Issue 1: Vertex Classification (Convex/Concave)
- We're using `isEdgeFrontFacing` to filter edges, but this is causing us to skip important vertices
- The problem: After fixing "double shadows", we became too aggressive in filtering
- We need BOTH convex and concave vertices to properly define the polygon boundary

### Issue 2: Arc Integration
We have two manifestations of poor arc handling:
1. **Over-scanning**: Seeing beyond the 120° FOV (up to 340°)
2. **Secant shortcuts**: Straight lines between sparse points instead of curved arcs

## What the Research Tells Us

### From Sundaram Ramaswamy's Implementation:

1. **Angle Points** come from:
   - Edge endpoints within the sector
   - **Arc-edge intersections** (critical!)
   - **Implicit boundary points** at sector edges

2. **Arc Integration Strategy**:
   - When consecutive hit points are both at max range, connect with arc
   - BUT check if the line between them is parallel to a blocking edge
   - If parallel, use a line segment instead

3. **Performance Optimization**:
   - Broad phase: Bounding circle rejection
   - Narrow phase: Detailed intersection tests
   - Conservative culling (when in doubt, include)

### From legends2k's 2D FOV:

- Emphasizes that bounded FOV requires more careful handling than 360° visibility
- The sector boundary (arc) is an active part of the visibility polygon
- Need to handle wraparound cases carefully

## The Real Solution

We need to fundamentally change how we think about the visibility polygon:

### 1. **Proper Angle Point Collection**
```
Angle points = {
  - Edge endpoints within FOV
  - Arc-edge intersection points  
  - FOV boundary points (left/right bounds)
}
```

### 2. **Correct Arc Integration**
Instead of adding arc points as an afterthought:
- Treat the arc as a **boundary constraint**
- When a ray reaches max distance, the hit point is ON the arc
- Connect consecutive arc points with arc segments, not lines

### 3. **Edge Filtering Reform**
Our `getVisibleWallCorners` is too restrictive. We should:
- Include ALL corners within FOV initially
- Let the ray casting determine which are actually visible
- Use auxiliary rays for corner extension (already implemented)

## Proposed Implementation Changes

1. **Stop filtering corners aggressively** - let ray casting handle visibility
2. **Add arc-edge intersection detection** - these are critical angle points
3. **Properly integrate arc segments** - not as interpolated points but as boundary elements
4. **Fix angle normalization** to prevent over-scanning

The key insight: We're not drawing a polygon that happens to have an arc - we're drawing a **sector** that gets modified by wall intersections. 