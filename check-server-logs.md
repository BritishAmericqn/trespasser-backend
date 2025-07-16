# How to Find the Visibility System Debug Logs

## Where to Look

The debug logs appear in the **SERVER CONSOLE** - the terminal window where you ran `npm run dev`, NOT in the test script terminal.

## What You Should See

When the visibility system is working, you'll see messages like:

```
[CornerDebug] Visibility calculation:
  - Walls processed: 12
  - Total corners found: 48
  - Arc intersections found: 2    <-- This is key! Shows walls crossing the vision circle
  - Filtered by distance: 15
  - Filtered by FOV: 20
  - Final corners: 13
  - Viewer at: (240, 135), looking 45.0°

[VisibilityPolygon] Created polygon with 27 points (5 original arc points), direction: 45.0°
```

## Key Things to Verify

1. **Arc intersections found > 0** when walls cross your vision circle
2. **Polygon points increase** when arc interpolation adds smooth curves
3. **No [AngleDebug] errors** about angles outside [-π, π] range

## To See the Logs

1. Find the terminal where you ran `npm run dev`
2. Move your mouse in the game - this triggers visibility recalculation
3. Watch for [CornerDebug] and [VisibilityPolygon] messages

## Manual Test

Run this to keep a player connected while you test:
```bash
node test-visibility-manual.js
```

Then move your mouse in the game frontend and watch the server console! 