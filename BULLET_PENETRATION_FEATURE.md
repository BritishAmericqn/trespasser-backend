# Bullet Penetration Feature

## Overview

Implemented bullet penetration for hitscan weapons (rifle, pistol) through soft walls (wood, glass). This adds a tactical layer where soft cover provides less protection than hard cover.

## How It Works

### Penetration Rules

1. **Hard Walls (Concrete/Metal)**: 
   - Bullets **STOP** completely
   - No penetration regardless of damage

2. **Soft Walls (Wood/Glass)**:
   - Bullets can **PENETRATE** if they have enough damage
   - Each penetration extracts **15 damage** from the bullet
   - Bullet continues with reduced damage

3. **Destroyed Slices**:
   - Bullets pass through **without damage reduction**
   - Already destroyed slices don't affect penetration

### Damage Calculation

```
Initial Damage → Soft Wall → Remaining Damage
     25       -     15     =      10

Example: Rifle (25 damage)
- Hits soft wall → Wall takes 15 damage, bullet continues with 10 damage
- Hits second soft wall → Wall takes 10 damage, bullet stops (not enough to penetrate)
```

## Examples

### Rifle (25 damage)

1. **Through 1 Soft Wall**:
   - Wall takes: 15 damage
   - Bullet continues with: 10 damage
   - Can still damage players/walls behind

2. **Through 2 Soft Walls**:
   - First wall: 15 damage (bullet continues with 10)
   - Second wall: 10 damage (bullet stops)

### Pistol (35 damage)

1. **Through 2 Soft Walls**:
   - First wall: 15 damage (bullet continues with 20)
   - Second wall: 15 damage (bullet continues with 5)
   - Third wall: 5 damage (bullet stops)

## Technical Implementation

### New Methods

1. **`raycastWithPenetration()`**: Traces bullet path through multiple targets
2. **`performHitscanWithPenetration()`**: Handles accuracy and calls penetration raycast
3. **`PenetrationHit` interface**: Tracks each hit with damage applied

### Key Features

- Tracks cumulative damage reduction
- Processes hits in distance order
- Stops at hard walls or players
- Applies appropriate damage to each target

## Gameplay Impact

### Tactical Considerations

1. **Cover Selection**:
   - Hard walls (concrete/metal) provide full protection
   - Soft walls (wood/glass) only reduce damage
   - Multiple soft walls needed for full protection

2. **Offensive Strategies**:
   - Can damage enemies behind soft cover
   - Wall-banging through wood/glass is viable
   - Higher damage weapons penetrate more walls

3. **Defensive Strategies**:
   - Position behind hard cover when possible
   - Use multiple layers of soft cover
   - Be aware of penetration angles

### Balance

- **15 damage threshold** ensures:
  - Rifles can penetrate 1 soft wall effectively
  - Pistols can penetrate 2 soft walls
  - Low-damage weapons can't penetrate
  - Prevents excessive wall-banging

## Network Considerations

- All hits from a single shot are processed together
- Multiple damage events sent in one update
- `penetrationCount` included in hit events for UI feedback 