# 🔧 Restart Partial Walls Fix

## Problem
When the game restarts via admin controls, all walls were being restored to full health, including partial walls that were intentionally created with pre-destroyed slices during map loading.

## Root Cause
The `resetAllWalls()` method was calling `repairWall()` for every wall, which restored all slices to `maxHealth`. There was no distinction between:
- **Initial destruction**: Slices destroyed during map load (design intent)
- **Gameplay destruction**: Slices destroyed by player actions

## Solution: Initial State Preservation

### 1. Added Optional Field to WallState
```typescript
interface WallState {
  // ... existing fields ...
  initialSliceHealth?: number[]; // Snapshot of health after map load
}
```

### 2. Capture Initial State in MapLoader
After applying pre-destruction damage to partial walls:
```typescript
this.destructionSystem.captureWallInitialState(createdWall.id);
```

### 3. Modified Reset Behavior
- `resetAllWalls()` now restores to initial state when available
- `repairWall()` respects initial state limits
- `repairSlice()` won't repair beyond initial health

## Benefits
- ✅ Partial walls maintain their design intent after restart
- ✅ Backward compatible (optional field)
- ✅ Minimal code changes
- ✅ Clear semantics
- ✅ No performance impact

## Testing
1. Load a map with partial walls
2. Damage some walls during gameplay
3. Use admin restart
4. Verify:
   - Partial walls still have their pre-destroyed slices
   - Gameplay damage is reset
   - Full walls are fully repaired 