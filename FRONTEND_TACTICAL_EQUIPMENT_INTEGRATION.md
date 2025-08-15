# Frontend Integration Guide - Tactical Equipment Systems

## Overview

The backend now supports advanced smoke grenades and flashbangs with realistic tactical mechanics. The frontend needs to integrate these systems for visual effects, audio cues, and UI feedback.

## New Data Structures

### Enhanced Player State
```typescript
interface PlayerState {
  // ... existing fields ...
  effectState?: {
    flashbangIntensity: number;        // 0-1, current flash effect strength
    flashbangRecoveryPhase: 'blind' | 'disoriented' | 'recovering' | 'normal';
    flashbangEndTime: number;          // When effect fully ends
    visualImpairment: number;          // 0-1, visual clarity reduction
    audioImpairment: number;           // 0-1, audio clarity reduction  
    movementImpairment: number;        // 0-1, movement precision reduction
    lastFlashTime: number;             // Timestamp of last flash effect
  };
}
```

### Smoke Zone Data
```typescript
interface SmokeZone {
  id: string;
  position: Vector2;
  radius: number;               // Current radius
  maxRadius: number;            // Target radius (60px)
  createdAt: number;            // Creation timestamp
  duration: number;             // Total lifetime (15 seconds)
  expansionTime: number;        // Time to reach full size (1.5 seconds)
  density: number;              // Current opacity (0-1)
  maxDensity: number;           // Peak opacity (0.9)
  windDirection: number;        // Unused (always 0)
  windSpeed: number;            // Unused (always 0)
  driftPosition: Vector2;       // Same as position (no drift)
  type: 'smoke';
}
```

## New Events to Handle

### 1. Smoke Deployment
```typescript
// Event: projectile_exploded with type: 'smoke'
socket.on('projectile_exploded', (data) => {
  if (data.type === 'smoke') {
    // Start smoke deployment animation
    createSmokeEffect(data.position, data.radius);
  }
});
```

### 2. Flashbang Effects
```typescript
// Event: FLASHBANG_EFFECT
socket.on('FLASHBANG_EFFECT', (data) => {
  // Apply visual/audio effects based on player involvement
  const myPlayer = data.affectedPlayers.find(p => p.playerId === localPlayerId);
  if (myPlayer) {
    applyFlashbangEffect(myPlayer.intensity, myPlayer.duration, myPlayer.phases);
  }
});
```

## Required Frontend Implementations

### 1. Smoke Rendering System

#### Basic Smoke Particles
```javascript
class SmokeRenderer {
  constructor() {
    this.smokeZones = new Map();
    this.particleSystems = new Map();
  }
  
  createSmokeZone(smokeData) {
    const particles = this.createParticleSystem({
      position: smokeData.position,
      maxRadius: smokeData.maxRadius,
      density: smokeData.density,
      color: 'rgba(128, 128, 128, 0.8)',
      expansionTime: smokeData.expansionTime
    });
    
    this.smokeZones.set(smokeData.id, smokeData);
    this.particleSystems.set(smokeData.id, particles);
  }
  
  updateSmoke(deltaTime) {
    for (const [id, smokeZone] of this.smokeZones) {
      const age = Date.now() - smokeZone.createdAt;
      
      // Update expansion (1.5 seconds)
      if (age < smokeZone.expansionTime) {
        const progress = age / smokeZone.expansionTime;
        smokeZone.radius = smokeZone.maxRadius * this.easeOutCubic(progress);
      }
      
      // No drift - smoke stays at original position
      // smokeZone.driftPosition remains same as smokeZone.position
      
      // Update particle system
      this.updateParticleSystem(id, smokeZone);
      
      // Remove expired smoke (after 15 seconds)
      if (age >= smokeZone.duration) {
        this.removeSmokeZone(id);
      }
    }
  }
  
  render(ctx) {
    for (const [id, particles] of this.particleSystems) {
      this.renderParticleSystem(ctx, particles);
    }
  }
}
```

#### Advanced Smoke Integration
```javascript
// Integrate smoke with vision system
function renderWithSmokeOcclusion(ctx, gameState) {
  // 1. Render base game elements
  renderTerrain(ctx);
  renderWalls(ctx);
  
  // 2. Apply vision polygon clipping
  if (gameState.vision?.type === 'polygon') {
    ctx.save();
    ctx.beginPath();
    gameState.vision.polygon.forEach((point, i) => {
      if (i === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    });
    ctx.clip();
    
    // 3. Render visible game objects
    renderPlayers(ctx);
    renderProjectiles(ctx);
    
    ctx.restore();
  }
  
  // 4. Render smoke effects (on top of vision)
  smokeRenderer.render(ctx);
  
  // 5. Apply fog of war outside vision
  renderFogOfWar(ctx, gameState.vision);
}
```

### 2. Flashbang Effect System

#### Visual Effects Implementation
```javascript
class FlashbangEffectRenderer {
  constructor() {
    this.activeEffects = new Map();
  }
  
  applyFlashbangEffect(playerId, intensity, duration, phases) {
    const effect = {
      intensity,
      duration,
      phases,
      startTime: Date.now(),
      currentPhase: 'blind'
    };
    
    this.activeEffects.set(playerId, effect);
    
    // Trigger immediate visual effect
    this.triggerFlashEffect(intensity);
  }
  
  triggerFlashEffect(intensity) {
    // White screen flash
    const flash = document.createElement('div');
    flash.style.cssText = `
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: white;
      opacity: ${intensity};
      pointer-events: none;
      z-index: 9999;
      transition: opacity 0.1s ease-out;
    `;
    document.body.appendChild(flash);
    
    // Fade out over 200ms
    setTimeout(() => {
      flash.style.opacity = '0';
      setTimeout(() => flash.remove(), 200);
    }, 100);
  }
  
  updateEffects(deltaTime) {
    for (const [playerId, effect] of this.activeEffects) {
      const elapsed = Date.now() - effect.startTime;
      const progress = elapsed / effect.duration;
      
      if (progress >= 1) {
        this.activeEffects.delete(playerId);
        continue;
      }
      
      // Update recovery phase
      this.updateRecoveryPhase(effect, progress);
      
      // Apply current effects
      this.applyVisualImpairment(effect.visualImpairment);
      this.applyAudioImpairment(effect.audioImpairment);
      this.applyMovementImpairment(effect.movementImpairment);
    }
  }
  
  applyVisualImpairment(intensity) {
    // Blur effect
    const gameCanvas = document.getElementById('gameCanvas');
    if (gameCanvas) {
      gameCanvas.style.filter = `blur(${intensity * 5}px) brightness(${1 + intensity * 0.5})`;
    }
  }
  
  applyAudioImpairment(intensity) {
    // Reduce game audio and add ringing
    if (window.audioContext) {
      const gainNode = window.audioContext.createGain();
      gainNode.gain.value = 1 - (intensity * 0.8);
      
      // Add ringing sound effect
      if (intensity > 0.5) {
        this.playRingingSound(intensity);
      }
    }
  }
  
  applyMovementImpairment(intensity) {
    // Reduce input sensitivity
    window.flashbangMovementImpairment = intensity;
  }
}
```

### 3. Input Handling Modifications

```javascript
// Modify input handling to account for flashbang effects
function processPlayerInput(input) {
  // Apply movement impairment
  if (window.flashbangMovementImpairment > 0) {
    const impairment = window.flashbangMovementImpairment;
    
    // Reduce mouse sensitivity
    input.mouse.x *= (1 - impairment * 0.5);
    input.mouse.y *= (1 - impairment * 0.5);
    
    // Add slight input delay/jitter
    if (Math.random() < impairment * 0.3) {
      // Skip this input frame occasionally
      return null;
    }
  }
  
  return input;
}
```

### 4. UI Indicators

```javascript
// Status indicators for tactical effects
function renderTacticalStatus(ctx, player) {
  if (player.effectState?.flashbangIntensity > 0) {
    const intensity = player.effectState.flashbangIntensity;
    const phase = player.effectState.flashbangRecoveryPhase;
    
    // Draw effect indicator
    ctx.fillStyle = `rgba(255, 255, 0, ${intensity * 0.8})`;
    ctx.fillRect(10, 10, 200 * intensity, 10);
    
    // Draw phase text
    ctx.fillStyle = 'white';
    ctx.font = '12px Arial';
    ctx.fillText(`Flash: ${phase.toUpperCase()}`, 10, 35);
  }
}
```

## Audio Integration

### Sound Effects Needed

1. **Smoke Grenade Sounds:**
   - `smoke_pin_pull.wav` - Pin removal
   - `smoke_throw.wav` - Throwing sound
   - `smoke_deploy.wav` - Smoke deployment hiss
   - `smoke_ambient.wav` - Ongoing smoke sound (looped)

2. **Flashbang Sounds:**
   - `flash_pin_pull.wav` - Pin removal
   - `flash_throw.wav` - Throwing sound  
   - `flash_explosion.wav` - Detonation sound
   - `flash_ringing.wav` - Tinnitus effect (for affected players)

### Audio Implementation
```javascript
// Play tactical equipment sounds
function playTacticalSound(soundType, position, volume = 1.0) {
  const audio = new Audio(`/sounds/${soundType}.wav`);
  audio.volume = volume;
  
  // 3D positional audio if supported
  if (window.audioContext) {
    const source = window.audioContext.createMediaElementSource(audio);
    const panner = window.audioContext.createPanner();
    
    panner.setPosition(position.x, position.y, 0);
    source.connect(panner).connect(window.audioContext.destination);
  }
  
  audio.play();
}
```

## Performance Considerations

### Optimization Strategies

1. **Particle Count Limits:**
   ```javascript
   const MAX_SMOKE_PARTICLES = 100;
   const PARTICLE_POOL_SIZE = 500; // Reuse particles
   ```

2. **Effect Culling:**
   ```javascript
   // Only render smoke zones within viewport
   function cullSmokeZones(smokeZones, viewport) {
     return smokeZones.filter(zone => 
       isInViewport(zone.driftPosition, zone.radius, viewport)
     );
   }
   ```

3. **Frame Rate Management:**
   ```javascript
   // Reduce effect quality on low-end devices
   const effectQuality = detectDeviceCapability();
   const particleCount = Math.floor(BASE_PARTICLES * effectQuality);
   ```

## Testing Checklist

### Visual Effects
- [ ] Smoke zones expand smoothly over 1.5 seconds
- [ ] Smoke remains stationary at deployment location
- [ ] Smoke fades out in the last 2 seconds before dispersing
- [ ] Vision is properly blocked through smoke
- [ ] Flashbang creates appropriate white-out effect
- [ ] Recovery phases show progressive improvement

### Audio Effects
- [ ] Spatial audio works for all tactical sounds
- [ ] Flashbang ringing effect applies to affected players
- [ ] Audio impairment reduces game sounds appropriately

### UI/UX
- [ ] Effect status indicators display correctly
- [ ] Input impairment feels realistic but not frustrating
- [ ] Performance remains smooth with multiple effects

### Integration
- [ ] Works with existing vision system
- [ ] Compatible with current weapon switching
- [ ] Multiplayer synchronization is accurate

## Quick Start Implementation

1. **Add event listeners** for new tactical events
2. **Implement basic smoke particle system** 
3. **Add flashbang visual effects** (white screen, blur)
4. **Integrate with existing rendering pipeline**
5. **Add audio effects** for immersion
6. **Test with provided backend test script**

The backend systems are fully implemented and tested. The frontend integration points are clearly defined above. The most critical items to implement first are the smoke rendering and flashbang visual effects, as these directly impact gameplay visibility and player experience.

