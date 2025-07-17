# Bullet Penetration Crash Fix

## Issue
The bullet penetration system was causing server crashes, particularly when shooting at concrete walls. The server would enter an infinite loop and crash.

## Root Cause
When continuing the ray after hitting a wall, the code was setting the new start position exactly at the hit point:
```typescript
currentStart = closestHit.hitPoint;
```

This caused the ray to immediately hit the same wall again on the next iteration, creating an infinite loop.

## Solution

### 1. Epsilon Offset
Added a small offset (epsilon = 0.1) when continuing the ray to ensure it starts slightly past the hit point:
```typescript
const epsilon = 0.1;
currentStart = {
  x: closestHit.hitPoint.x + direction.x * epsilon,
  y: closestHit.hitPoint.y + direction.y * epsilon
};
remainingDistance -= (closestHit.distance + epsilon);
```

### 2. Iteration Limit
Added a safety limit to prevent infinite loops:
```typescript
let iterations = 0;
const maxIterations = 20; // Safety limit

while (currentDamage > 0 && remainingDistance > 0 && iterations < maxIterations) {
  iterations++;
  // ... rest of the loop
}
```

## Changes Applied
1. Fixed destroyed slice continuation logic
2. Fixed soft wall penetration continuation logic
3. Added iteration safety limit
4. Added optional debug logging

## Testing
The server should now handle all wall types without crashing:
- Hard walls (concrete/metal) stop bullets completely
- Soft walls (wood/glass) allow penetration with damage reduction
- Destroyed slices allow bullets through without damage reduction 