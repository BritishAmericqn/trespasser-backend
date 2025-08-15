# FLASHBANG AND SMOKE GRENADE FINAL UPDATES

## Date: December 2024

## Changes Made

### 1. FLASHBANG LINE-OF-SIGHT FIXES
Fixed the issue where flashbangs were affecting players through walls or when looking away:

#### Configuration Changes (`shared/constants/index.ts`):
- `ANGLE_EFFECT_MULTIPLIER`: Changed from 0.6 to **0.9** - Much stronger reduction when not looking directly
- `WALL_PENETRATION_FACTOR`: Changed from 0.3 to **0.1** - Minimal 10% effect through walls

#### Logic Changes (`src/systems/FlashbangEffectSystem.ts`):
- Added extra reduction for looking away more than 90 degrees (> 0.5 viewing angle)
- Raised minimum intensity threshold from 0.05 to **0.15** - No effect below 15% intensity
- Fixed wall destruction check to properly handle destroyed walls
- Improved comments for clarity

### 2. SMOKE GRENADE DURATION UPDATE
Changed smoke duration from 8 seconds to **15 seconds** as requested:

#### Configuration (`shared/constants/index.ts`):
- `SMOKE_DURATION`: Changed from 8000 to **15000** (15 seconds)

#### Documentation Updates:
- `TACTICAL_EQUIPMENT_SYSTEM.md`: Updated to reflect 15 second duration
- `FRONTEND_SMOKE_FLASHBANG_COMPLETE_GUIDE.md`: All references updated to 15 seconds
- `FRONTEND_TACTICAL_EQUIPMENT_INTEGRATION.md`: Updated duration references

## How It Works Now

### Flashbangs:
- **NO EFFECT** if:
  - Player is behind a wall (only 10% penetration)
  - Player is looking more than 90 degrees away
  - Final intensity is below 15%
- **REDUCED EFFECT** if:
  - Player is looking partially away (90% reduction based on angle)
  - Player is at a distance (falloff based on radius)

### Smoke Grenades:
- **Behavior**:
  - Expands over 1.5 seconds
  - Stays at full density for 13.5 seconds
  - Total duration: 15 seconds
  - No drift - stays stationary
  - 95% opacity at center, 50% at edges
  - Blocks vision when cumulative opacity reaches 50%

## Testing
After these changes, test the following:
1. Flashbangs should NOT affect players behind walls
2. Flashbangs should have minimal/no effect when looking away
3. Smoke grenades should last for 15 seconds total
4. All other functionality remains intact

## Build Status
✅ Successfully built with all changes
