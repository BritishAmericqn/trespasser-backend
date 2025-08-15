# Smoke Grenades & Vision System Integration Status

## Current Integration Status ✅ Partially Integrated

### ✅ What's Working

1. **Backend Vision Blocking**
   - `VisibilityPolygonSystem` has `SmokeZoneSystem` integration
   - Smoke zones properly block vision rays when opacity reaches 70%
   - Vision polygon is clipped at smoke boundaries
   - Cumulative opacity calculation works correctly

2. **Smoke Zone Management**
   - `SmokeZoneSystem` properly creates and updates smoke zones
   - Zones expand over 1.5 seconds, persist for 8 seconds
   - Opacity calculations work for point and ray queries

3. **System Initialization**
   - `GameStateSystem` properly initializes both systems
   - `SmokeZoneSystem` is passed to `VisibilityPolygonSystem` constructor
   - Updates are called each tick

### ❌ What's Missing

1. **Smoke Zones Not Sent to Frontend**
   - `GameState` interface doesn't include `smokeZones` field
   - `getState()` method doesn't include smoke zones
   - Frontend has no way to know where smoke zones are for rendering

### 🔧 Required Fix

To complete the integration, we need to:

1. **Update GameState Interface** (`shared/types/index.ts`)
   ```typescript
   export interface GameState {
     players: Map<string, PlayerState>;
     walls: Map<string, WallState>;
     projectiles: ProjectileState[];
     smokeZones?: SmokeZone[];  // ADD THIS
     timestamp: number;
     // ... rest
   }
   ```

2. **Update getState() Method** (`src/systems/GameStateSystem.ts`)
   ```typescript
   getState(): GameState {
     // ... existing code ...
     return {
       players: playersObject,
       walls: wallsObject,
       projectiles: this.projectileSystem.getProjectiles(),
       smokeZones: this.smokeZoneSystem.getSmokeZones(),  // ADD THIS
       timestamp: Date.now(),
       tickRate: GAME_CONFIG.TICK_RATE
     };
   }
   ```

### 📊 Summary

The smoke zones ARE integrated with the vision system for blocking sight, but they're NOT being sent to the frontend for rendering. The vision polygon will be properly clipped by smoke, but the frontend won't be able to render the actual smoke clouds without receiving the smoke zone data in the game state.
