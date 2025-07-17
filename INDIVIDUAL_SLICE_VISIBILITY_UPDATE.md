# Individual Slice Visibility Update

## Summary

Updated the vision system to make it **harder** to see through walls. Each slice now acts as its own individual barrier with material-specific visibility thresholds.

## Previous Behavior ❌
- **ANY** damage to a slice allowed vision through that slice
- Made walls too easy to see through

## New Behavior ✅

### Hard Walls (Concrete/Metal)
- Individual slices **ONLY** allow vision when **completely destroyed** (health = 0)
- No partial visibility - it's all or nothing per slice

### Soft Walls (Wood/Glass)  
- Individual slices allow vision when **heavily damaged** (health < 25% of max)
- Provides a middle ground between hard walls and the old system

## Implementation Details

### Health Thresholds
```typescript
// Hard walls (concrete/metal)
sliceHealth <= 0  // Must be fully destroyed

// Soft walls (wood/glass)
sliceHealth < maxHealth * 0.25  // Less than 25% health
```

### Material Health Values
- **Concrete**: 150 HP per slice (hard wall)
- **Metal**: 200 HP per slice (hard wall)
- **Wood**: 80 HP per slice (soft wall)
- **Glass**: 30 HP per slice (soft wall)

### Damage Required for Vision

#### Hard Walls
- **Concrete slice**: 150 damage to see through
- **Metal slice**: 200 damage to see through

#### Soft Walls
- **Wood slice**: ~60 damage to see through (75% of 80 HP)
- **Glass slice**: ~23 damage to see through (75% of 30 HP)

## Example Scenarios

### Rifle (25 damage per shot)

1. **Concrete Wall**
   - 6 shots to destroy one slice and see through it
   - No visibility until slice is completely destroyed

2. **Wood Wall**
   - 3 shots to heavily damage a slice and see through it
   - Partial visibility starts after significant damage

3. **Glass Wall**
   - 1 shot to see through a slice
   - Most fragile material

### Rocket (150 damage)

1. **Concrete Wall**
   - 1 rocket destroys a slice completely
   - Instant visibility through that slice

2. **Metal Wall**
   - 1 rocket heavily damages but doesn't destroy
   - Need 2 rockets for full destruction and visibility

## Technical Changes

1. Added `shouldSliceAllowVision()` and `shouldSliceBlockVisionByHealth()` functions
2. Both vision systems now track slice health in addition to destruction masks
3. Vision checks use actual health values instead of binary destroyed/intact state
4. Slice boundaries respect the new health-based thresholds

## Gameplay Impact

- **More tactical cover**: Can't easily create peek holes with minimal damage
- **Material choice matters**: Hard walls provide reliable cover, soft walls are more vulnerable
- **Resource management**: Players need more ammo to create sight lines through hard walls
- **Predictable behavior**: Clear thresholds for when visibility is granted 