# Smoke Grenade & Vision System Improvements

## Changes Made

### 1. Throw Speed Fixed ✅
- **Smoke Grenade**: 180 → 20 (now matches frag grenade)
- **Flashbang**: 200 → 20 (now matches frag grenade)
- Both tactical grenades now have the same throw physics as regular grenades

### 2. Vision Blocking Improved ✅

#### Opacity Settings
- **Max Density**: 0.9 → 0.95 (more opaque at center)
- **Edge Fade**: 0.3 → 0.5 (less transparent at edges)
- Result: Smoke is now 95% opaque at center, 50% at edges

#### Vision Calculation
- **Opacity Accumulation**: 0.1 → 0.3 per sample (more aggressive)
- **Blocking Threshold**: 0.7 → 0.5 (blocks vision more easily)
- Result: Vision rays accumulate opacity faster and block at lower threshold

### 3. How It Works Now

When a vision ray passes through smoke:
1. Every 5 pixels, we sample the smoke opacity at that point
2. Opacity accumulates at 0.3x the smoke density per sample
3. When cumulative opacity reaches 50%, vision is blocked
4. Smoke at center (95% density) blocks vision in ~2 samples
5. Smoke at edges (50% density) blocks vision in ~3-4 samples

### 4. Effective Range

With these settings:
- **Dense smoke (center)**: Blocks vision after ~10 pixels
- **Medium smoke (mid-range)**: Blocks vision after ~15-20 pixels  
- **Light smoke (edges)**: Blocks vision after ~25-30 pixels
- **Full smoke cloud**: 60px radius effectively blocks all vision through it

### 5. Throw Physics

Tactical grenades now behave identically to frag grenades:
- Base speed: 20 units/second
- Affected by gravity
- Bounce off walls
- Can be charged for longer throws

## Testing

The smoke should now:
1. Be thrown at a realistic speed (not flying across the map)
2. Effectively block vision when looking through it
3. Create a solid visual barrier for tactical gameplay
4. Work consistently with the polygon vision system

## Frontend Notes

- Smoke zones are denser now (95% center, 50% edges)
- Vision polygon will be clipped more aggressively by smoke
- Throw animations should match frag grenade speed
