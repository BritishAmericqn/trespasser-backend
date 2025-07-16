# Visibility Polygon System Redesign

## Changes Made

### 1. Simplified Corner Filtering
- **Before**: Used `getVisibleWallCorners` with aggressive edge filtering based on front-facing logic
- **After**: Renamed to `getAllWallCorners`, returns all 4 corners of each wall
- **Rationale**: Let FOV filtering and ray casting determine visibility, not pre-filtering

### 2. Added Arc-Edge Intersection Detection
- **New Method**: `findArcEdgeIntersections` finds where wall edges cross the vision circle
- **Integration**: These intersection points are added as angle points
- **Impact**: Smooth transitions between walls and arc boundaries

### 3. Removed Arc Interpolation as Afterthought
- **Before**: Added interpolated points for any large angular gap
- **After**: Only interpolate between consecutive points that are both on the arc
- **Rationale**: Arc is a boundary, not just sparse points to fill

### 4. Improved Angle Normalization
- **Added**: Consistent angle normalization to [-π, π] range
- **Applied to**: FOV bounds, corner angles, all calculations
- **Result**: No more 380° gaps or angles outside valid range

### 5. Better Arc Integration
- **Track**: Which hit points are on the arc vs walls
- **Interpolate**: Only between consecutive arc points
- **Smart**: Only add interpolation when angular gap > 10°

## Key Improvements

1. **More Accurate**: All wall corners considered, not just "front-facing" ones
2. **Smoother Arcs**: Arc-edge intersections create natural transitions
3. **Less Artifacts**: No more triangular shortcuts from sparse corners
4. **Consistent FOV**: Proper angle normalization prevents over-scanning

## Algorithm Flow

1. Collect angle points:
   - All wall corners within FOV
   - Arc-edge intersection points
   - FOV boundary angles

2. Cast rays to all angle points

3. Identify which hit points are on the arc

4. Interpolate arc segments between consecutive arc points

5. Return complete visibility polygon

This design treats the vision sector as a primary constraint, not an afterthought, resulting in more accurate and visually pleasing visibility polygons. 