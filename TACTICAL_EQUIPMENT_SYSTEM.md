# Tactical Equipment System - Smoke Grenades & Flashbangs

## Overview

This system implements advanced smoke grenades and flashbangs with realistic tactical mechanics, including dynamic vision occlusion, line-of-sight calculations, and multi-phase effect recovery.

## System Architecture

### Core Components

1. **SmokeZoneSystem** - Manages smoke zone lifecycle and vision blocking
2. **FlashbangEffectSystem** - Calculates and applies flashbang effects
3. **Enhanced VisibilityPolygonSystem** - Integrates smoke occlusion into vision calculations
4. **Updated GameStateSystem** - Coordinates all tactical systems

## Smoke Grenades

### Deployment Mechanics
- **Fuse Time**: 2 seconds before deployment
- **Expansion**: Gradually expands to full radius over 3 seconds
- **Duration**: 15 seconds total lifetime
- **Wind Drift**: Smoke drifts with randomized wind patterns
- **Density**: Variable opacity from center (90%) to edges (30%)

### Vision Occlusion
- **Ray-based Integration**: Vision rays accumulate opacity when passing through smoke
- **Cumulative Effect**: Multiple smoke zones stack for increased density
- **Threshold System**: Vision is blocked when cumulative opacity reaches 70%
- **Dynamic Clipping**: Visibility polygons are dynamically modified by smoke zones

### Technical Implementation
```typescript
// Smoke zone creation
const smokeZone = smokeZoneSystem.createSmokeZone(id, position);

// Vision integration
const opacity = smokeZoneSystem.calculateSmokeOpacityAtPoint(rayPoint);
if (opacity >= 0.7) {
  // Vision blocked at this point
}
```

## Flashbangs

### Effect Calculation
- **Distance Falloff**: Exponential intensity decrease with distance (120px max radius)
- **Line-of-Sight**: Reduced effect through walls (30% penetration factor)
- **Viewing Angle**: Effect reduced when not looking directly at flash
- **Base Durations**: 
  - Blind: 1.5 seconds
  - Disoriented: 2 seconds  
  - Recovering: 1 second

### Recovery Phases
1. **Blind Phase**: Complete visual impairment, full audio/movement reduction
2. **Disoriented Phase**: Gradual visual recovery, reduced precision
3. **Recovering Phase**: Minor impairment, near-normal function
4. **Normal**: Full recovery

### Effect Modifiers
- **Distance**: `intensity = 1 - (distance/radius)^0.8`
- **Viewing Angle**: `intensity *= (1 - angle * 0.6)`
- **Wall Penetration**: `intensity *= 0.3` through walls

## Configuration

### Smoke Grenade Settings
```typescript
SMOKEGRENADE: {
  SMOKE_RADIUS: 60,           // Maximum radius
  SMOKE_DURATION: 15000,      // 15 seconds
  SMOKE_EXPANSION_TIME: 3000, // 3 second expansion
  SMOKE_MAX_DENSITY: 0.9,     // 90% opacity at center
  SMOKE_WIND_SPEED: 8,        // Drift speed
  SMOKE_EDGE_FADE: 0.3,       // Edge opacity multiplier
  FUSE_TIME: 2000             // 2 second fuse
}
```

### Flashbang Settings
```typescript
FLASHBANG: {
  EFFECT_RADIUS: 120,               // Effect range
  MAX_EFFECT_DURATION: 4000,        // Maximum total effect
  BLIND_DURATION_BASE: 1500,        // Base blind time
  DISORIENTED_DURATION_BASE: 2000,  // Base disorientation
  RECOVERING_DURATION_BASE: 1000,   // Base recovery
  DISTANCE_FALLOFF: 0.8,            // Distance curve
  ANGLE_EFFECT_MULTIPLIER: 0.6,     // Viewing angle penalty
  WALL_PENETRATION_FACTOR: 0.3,     // Through-wall effect
  FUSE_TIME: 1500                   // 1.5 second fuse
}
```

## Usage Examples

### Backend Integration
```typescript
// In GameStateSystem update loop
this.smokeZoneSystem.update(deltaTime);
this.flashbangEffectSystem.updatePlayerEffects(player, deltaTime);

// Handle special explosions
if (explodeEvent.type === 'smoke') {
  this.smokeZoneSystem.createSmokeZone(explodeEvent.id, explodeEvent.position);
} else if (explodeEvent.type === 'flash') {
  const flashEffect = this.flashbangEffectSystem.calculateFlashbangEffects(
    explodeEvent.position, this.players, this.walls
  );
  // Apply effects to players...
}
```

### Frontend Integration
```typescript
// Handle smoke zones in rendering
if (gameState.smokeZones) {
  for (const smokeZone of gameState.smokeZones) {
    renderSmokeEffect(smokeZone);
  }
}

// Handle flashbang effects
if (player.effectState?.flashbangIntensity > 0) {
  applyVisualImpairment(player.effectState.visualImpairment);
  applyAudioImpairment(player.effectState.audioImpairment);
  applyMovementImpairment(player.effectState.movementImpairment);
}
```

## Testing

Use the included test script to verify functionality:

```bash
node test-smoke-flashbang.js
```

### Test Coverage
- ✅ Smoke grenade deployment and expansion
- ✅ Wind drift and density gradients  
- ✅ Vision occlusion integration
- ✅ Flashbang line-of-sight calculation
- ✅ Multi-phase effect recovery
- ✅ Distance and angle modifiers
- ✅ Wall penetration effects

## Performance Considerations

### Optimizations Implemented
- **Efficient Ray Sampling**: Only 5-pixel intervals for smoke checks
- **Early Exit**: Stop at 90% opacity threshold
- **Bounded Updates**: Smoke zones auto-expire and cleanup
- **Cached Calculations**: Vision polygon integration minimizes redundant work

### Memory Management
- Automatic cleanup of expired smoke zones
- Efficient player effect state updates
- Minimal frontend data transmission

## Future Enhancements

### Potential Additions
- **Tear Gas**: Damage-over-time in smoke zones
- **Smoke Variations**: Different colors/effects for teams
- **Environmental Interaction**: Smoke affected by map geometry
- **Advanced Flash Effects**: Directional intensity, equipment protection
- **Tactical Coordination**: Team-based effect immunity

## Compatibility

- ✅ Works with existing vision system
- ✅ Integrates with current weapon framework
- ✅ Compatible with destruction system
- ✅ Frontend-agnostic implementation
- ✅ Multiplayer synchronized

This system provides a solid foundation for tactical gameplay while maintaining performance and extensibility for future enhancements.
