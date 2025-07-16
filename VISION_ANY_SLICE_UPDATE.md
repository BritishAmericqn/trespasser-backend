# Vision System Update: See Through Any Destroyed Slice

## Change Summary

Vision now passes through walls if **ANY slice is destroyed**, not just when 3+ slices are destroyed.

## Old Behavior
- Required 60% destruction (3+ slices out of 5)
- Players couldn't see through small holes in walls

## New Behavior
- **Any destroyed slice = vision can pass through**
- More realistic - if there's a hole, light gets through
- Single rifle shot creates a peek hole

## Technical Details

```typescript
// Before: Required counting destroyed slices
if (destroyedCount >= 3) {
    // Allow vision
}

// Now: Simple check
if (partial && partial.destroyedSlices > 0) {
    // If ANY slice is destroyed, allow vision through
}
```

## Gameplay Impact

- **More tactical** - Create small peek holes with single shots
- **More realistic** - Any gap allows vision
- **Destruction matters more** - Every shot counts
- **Encourages precision** - Target specific slices for sight lines

## Testing

1. Fire a single shot at a wall
2. You should immediately be able to see through that slice
3. No need to destroy 60% of the wall anymore

This change applies to both:
- Raycast vision (60 rays)
- Tile-based line-of-sight checks 