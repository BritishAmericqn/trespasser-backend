# Smoke Grenade Behavior Update

## Changes Made

Updated smoke grenade behavior to be stationary with faster expansion and shorter duration.

### Previous Behavior
- **Expansion Time**: 3 seconds
- **Total Duration**: 15 seconds  
- **Movement**: Drifted with randomized wind patterns
- **Wind Speed**: 8 pixels/second

### New Behavior
- **Expansion Time**: 1.5 seconds
- **Total Duration**: 8 seconds
- **Movement**: Stationary (no drift)
- **Wind Speed**: 0 (disabled)
- **Fade Out**: Last 2 seconds gradually fade

### Files Modified

1. **shared/constants/index.ts**
   - `SMOKE_DURATION`: 15000ms → 8000ms
   - `SMOKE_EXPANSION_TIME`: 3000ms → 1500ms
   - `SMOKE_WIND_SPEED`: 8 → 0

2. **src/systems/SmokeZoneSystem.ts**
   - Removed wind direction randomization
   - Removed drift calculations in update loop
   - Simplified smoke zone creation
   - Updated decay to start in last 2 seconds

3. **Documentation Updates**
   - TACTICAL_EQUIPMENT_SYSTEM.md
   - FRONTEND_TACTICAL_EQUIPMENT_INTEGRATION.md
   - test-smoke-flashbang.js (expected results)

### Rationale
- More predictable tactical gameplay
- Clearer zone control mechanics
- Reduced complexity for frontend rendering
- Better performance (no drift calculations)

### Frontend Impact
The frontend no longer needs to handle smoke drift animations. Smoke particles should:
1. Expand from deployment point over 1.5 seconds
2. Remain at full density for ~4.5 seconds
3. Fade out over the last 2 seconds
4. Stay centered at the original deployment position

The `driftPosition` field still exists for compatibility but will always equal `position`.
