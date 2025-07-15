# Grenade Velocity Update - COMPLETE ✅

## Summary
The backend has been updated to implement the new grenade velocity system as requested by the frontend team.

## Changes Made

### 1. Updated Type Definition
Added `chargeLevel` to `WeaponFireEvent` interface:
```typescript
export interface WeaponFireEvent {
  // ... existing fields ...
  chargeLevel?: number; // For grenades: 1-5
}
```

### 2. New Velocity Constants
Added to grenade weapon config:
```typescript
BASE_THROW_SPEED: 2,    // Much slower base speed for grenades
CHARGE_SPEED_BONUS: 6,  // Speed added per charge level
```

### 3. Updated Velocity Calculation
Grenades now use the formula: `speed = 2 + (chargeLevel * 6)`

This results in:
- Charge 1: 8 px/s
- Charge 2: 14 px/s
- Charge 3: 20 px/s
- Charge 4: 26 px/s
- Charge 5: 32 px/s

### 4. Fixed Event Handler
The `GameRoom.ts` weapon:fire handler now properly passes through the `chargeLevel` field from frontend events.

## Frontend Integration

The backend now expects `weapon:fire` events with this structure for grenades:
```javascript
{
  weaponType: 'grenade',
  position: { x, y },
  direction: angle,
  chargeLevel: 1-5,      // Required for grenades
  isADS: false,
  timestamp: number,
  sequence: number
}
```

## Backwards Compatibility

- The old `grenade:throw` event handler is still present but deprecated
- If no `chargeLevel` is provided, grenades fall back to the old default speed (200 px/s)

## Testing
All charge levels have been tested and verified to produce the correct velocities.

## Gameplay Impact
With these much slower speeds (8-32 px/s):
- Grenades travel only 24-96 pixels in their 3-second fuse time
- They're now suitable for close-range tactical use
- Players need to be much closer to their targets
- Charge mechanic is critical for any distance throws

## Next Steps
The frontend can now use the unified `weapon:fire` event for all grenade throws with proper charge-based velocities. 