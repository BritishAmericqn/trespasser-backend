# ✅ CRITICAL FIX: Grenade `projectile:created` Events Now Sent!

## The Bug
When throwing grenades with the 'G' key, the backend was:
- ✅ Creating the grenade projectile 
- ✅ Updating its position (physics working)
- ✅ Exploding it correctly
- ❌ **NOT sending the `projectile:created` event to clients!**

## Root Cause
```javascript
// BEFORE (src/systems/GameStateSystem.ts:573)
this.handleGrenadeThrow(grenadeThrowEvent);  // Return value ignored!
```

The `handleGrenadeThrow` function returns events (including `PROJECTILE_CREATED`) but the code was throwing them away!

## The Fix
```javascript
// AFTER (src/systems/GameStateSystem.ts:573-579)
const throwResult = this.handleGrenadeThrow(grenadeThrowEvent);
if (throwResult.success) {
  // Queue the events to be broadcast (including PROJECTILE_CREATED)
  for (const event of throwResult.events) {
    this.pendingProjectileEvents.push(event);
  }
}
```

## Impact
- Frontend was receiving `projectile:updated` for unknown projectiles
- Could not create visual tracers without the initial creation event
- Grenades worked mechanically but were invisible

## Verification
```bash
# Run the test script
node test-grenade-events.js

# Should now see:
# 🚀 PROJECTILE:CREATED received!
# 📍 projectile:updated received (first of many)
# 💥 projectile:exploded received!
```

## Frontend Should Now See
1. `projectile:created` - Creates grenade visual ✅
2. `projectile:updated` - Moves grenade visual (60Hz) ✅
3. `projectile:exploded` - Shows explosion effect ✅

## Status
**FIXED AND DEPLOYED** - Grenade tracers should now work immediately!
