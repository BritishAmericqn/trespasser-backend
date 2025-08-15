# COMPLETE FRONTEND IMPLEMENTATION GUIDE - SMOKE GRENADES & FLASHBANGS

## CRITICAL: READ EVERYTHING - ASSUME NOTHING

### WHAT YOU'RE BUILDING
Two tactical grenades that work like regular grenades but with special effects:
1. **Smoke Grenades** - Create smoke clouds that block vision for 15 seconds
2. **Flashbangs** - Blind and disorient players with white screen flash

---

## PART 1: DATA STRUCTURES YOU RECEIVE

### 1.1 SMOKE ZONES IN GAME STATE
```javascript
// You receive this in EVERY game state update via 'game:state' event
gameState = {
  players: { ... },
  walls: { ... },
  projectiles: [ ... ],
  smokeZones: [  // THIS IS NEW - ARRAY OF SMOKE ZONES
    {
      id: "projectile_1",
      position: { x: 240, y: 135 },      // Center of smoke
      radius: 30,                        // Current radius (grows to 60)
      maxRadius: 60,                     // Max size it will reach
      createdAt: 1755292683331,          // Timestamp when created
      duration: 8000,                    // Total lifetime in ms
      expansionTime: 1500,               // Time to reach full size
      density: 0.5,                      // Current opacity (0-1)
      maxDensity: 0.9,                   // Peak opacity
      windDirection: 0,                  // ALWAYS 0 - NO WIND
      windSpeed: 0,                      // ALWAYS 0 - NO DRIFT
      driftPosition: { x: 240, y: 135 }, // SAME AS position - NO MOVEMENT
      type: "smoke"
    }
  ],
  vision: { ... }
}
```

### 1.2 FLASHBANG EFFECT EVENT
```javascript
// You receive this ONCE when a flashbang explodes via 'FLASHBANG_EFFECT' event
socket.on('FLASHBANG_EFFECT', (data) => {
  data = {
    id: "flash_1755292683331_abc123",
    position: { x: 200, y: 100 },  // Where flashbang exploded
    affectedPlayers: [
      {
        playerId: "yourPlayerId",
        distance: 45.5,             // How far player was from explosion
        lineOfSight: true,          // Could see explosion
        viewingAngle: 0.2,          // 0=looking at it, 1=looking away
        intensity: 0.85,            // Effect strength (0-1)
        duration: 3400,             // Total effect time in ms
        phases: {
          blindDuration: 1275,      // Time fully blind
          disorientedDuration: 1700, // Time disoriented
          recoveringDuration: 850   // Time recovering
        }
      }
    ],
    timestamp: 1755292683331
  }
});
```

### 1.3 PLAYER EFFECT STATE
```javascript
// Players have effect state when flashbanged
player = {
  id: "playerId",
  position: { x: 100, y: 100 },
  // ... other player fields ...
  effectState: {  // ONLY EXISTS WHEN PLAYER IS AFFECTED
    flashbangIntensity: 0.85,      // Current effect strength
    flashbangRecoveryPhase: 'blind', // 'blind'|'disoriented'|'recovering'|'normal'
    flashbangEndTime: 1755296083331,  // When effect ends
    visualImpairment: 0.85,         // How much vision is impaired
    audioImpairment: 0.68,          // How much audio is impaired
    movementImpairment: 0.51,       // How much movement is impaired
    lastFlashTime: 1755292683331    // When they were flashed
  }
}
```

---

## PART 2: WEAPON SELECTION & USAGE

### 2.1 EQUIPPING TACTICAL GRENADES
```javascript
// Players must equip these in their loadout FIRST
socket.emit('weapon:equip', {
  primary: 'rifle',
  secondary: 'pistol',
  support: ['smokegrenade', 'flashbang']  // Can have both or just one
});
```

### 2.2 SWITCHING TO TACTICAL GRENADE
```javascript
// Switch to smoke grenade
socket.emit('weapon:switch', {
  toWeapon: 'smokegrenade',
  fromWeapon: 'rifle'  // Current weapon
});

// Switch to flashbang
socket.emit('weapon:switch', {
  toWeapon: 'flashbang',
  fromWeapon: 'smokegrenade'
});
```

### 2.3 THROWING TACTICAL GRENADE
```javascript
// Throw smoke grenade (same as regular grenade)
socket.emit('weapon:fire', {
  weaponType: 'smokegrenade',
  position: { x: player.x, y: player.y },
  direction: mouseAngle,  // Angle in radians
  isADS: false,
  timestamp: Date.now(),
  sequence: sequenceNumber++,
  chargeLevel: 0  // 0-5 for throw power
});
```

---

## PART 3: RENDERING SMOKE ZONES

### 3.1 SMOKE LIFECYCLE
1. **Creation** (0ms): Small circle, low opacity
2. **Expansion** (0-1500ms): Grows from 5px to 60px radius
3. **Full Size** (1500-6000ms): Stays at 60px, 90% opacity
4. **Fade Out** (6000-8000ms): Opacity drops to 0
5. **Removal** (8000ms): Disappears from game state

### 3.2 SIMPLE SMOKE RENDERING
```javascript
// In your render loop
function renderSmoke(ctx, gameState) {
  if (!gameState.smokeZones) return;
  
  for (const smoke of gameState.smokeZones) {
    const age = Date.now() - smoke.createdAt;
    
    // Skip if expired (shouldn't happen but be safe)
    if (age > smoke.duration) continue;
    
    // Calculate current radius
    let currentRadius = smoke.radius; // Backend already calculates this
    
    // Calculate current opacity
    let opacity = smoke.density; // Backend already calculates this
    
    // Draw smoke circle
    ctx.save();
    ctx.globalAlpha = opacity * 0.7; // Make it semi-transparent
    
    // Draw multiple circles for cloud effect
    for (let i = 0; i < 5; i++) {
      const offsetX = (Math.random() - 0.5) * 20;
      const offsetY = (Math.random() - 0.5) * 20;
      const sizeVariation = 0.8 + Math.random() * 0.4;
      
      ctx.beginPath();
      ctx.arc(
        smoke.position.x + offsetX,
        smoke.position.y + offsetY,
        currentRadius * sizeVariation,
        0, 
        Math.PI * 2
      );
      ctx.fillStyle = '#808080'; // Gray
      ctx.fill();
    }
    
    ctx.restore();
  }
}
```

### 3.3 BETTER SMOKE WITH PARTICLES
```javascript
class SmokeParticleSystem {
  constructor() {
    this.particles = [];
  }
  
  createSmokeCloud(smoke) {
    // Create 30 particles for this smoke zone
    for (let i = 0; i < 30; i++) {
      this.particles.push({
        smokeId: smoke.id,
        x: smoke.position.x + (Math.random() - 0.5) * 10,
        y: smoke.position.y + (Math.random() - 0.5) * 10,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        size: 10 + Math.random() * 20,
        opacity: 0.3 + Math.random() * 0.3,
        growthRate: 0.5 + Math.random() * 0.5
      });
    }
  }
  
  update(smokeZones) {
    // Update particles based on smoke zone state
    for (const particle of this.particles) {
      const smoke = smokeZones.find(s => s.id === particle.smokeId);
      if (!smoke) {
        // Smoke expired, fade out particle
        particle.opacity -= 0.02;
        continue;
      }
      
      const age = Date.now() - smoke.createdAt;
      const expansionProgress = Math.min(1, age / smoke.expansionTime);
      
      // Grow particle
      particle.size += particle.growthRate * expansionProgress;
      
      // Drift slightly
      particle.x += particle.vx;
      particle.y += particle.vy;
      
      // Fade based on smoke density
      particle.opacity = smoke.density * 0.5;
    }
    
    // Remove dead particles
    this.particles = this.particles.filter(p => p.opacity > 0);
  }
  
  render(ctx) {
    for (const particle of this.particles) {
      ctx.save();
      ctx.globalAlpha = particle.opacity;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fillStyle = '#999999';
      ctx.fill();
      ctx.restore();
    }
  }
}
```

---

## PART 4: FLASHBANG EFFECTS

### 4.1 WHEN TO APPLY EFFECTS
```javascript
socket.on('FLASHBANG_EFFECT', (data) => {
  // Find if local player was affected
  const myEffect = data.affectedPlayers.find(p => p.playerId === localPlayerId);
  
  if (myEffect) {
    // Apply flashbang effects
    applyFlashbang(myEffect);
  }
});
```

### 4.2 WHITE SCREEN FLASH
```javascript
function applyFlashbang(effect) {
  // Create white overlay
  const flash = document.createElement('div');
  flash.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: white;
    opacity: ${effect.intensity};
    pointer-events: none;
    z-index: 999999;
    transition: opacity 0.2s;
  `;
  document.body.appendChild(flash);
  
  // Fade out the initial flash
  setTimeout(() => {
    flash.style.opacity = effect.intensity * 0.5;
  }, 100);
  
  // Start recovery phases
  startRecoveryPhases(effect, flash);
}
```

### 4.3 RECOVERY PHASES
```javascript
function startRecoveryPhases(effect, flashDiv) {
  const phases = effect.phases;
  let currentTime = 0;
  
  // PHASE 1: BLIND (can't see anything)
  flashDiv.style.background = 'white';
  flashDiv.style.opacity = effect.intensity * 0.9;
  
  // PHASE 2: DISORIENTED (blurry, bright)
  setTimeout(() => {
    flashDiv.style.opacity = effect.intensity * 0.5;
    flashDiv.style.background = 'rgba(255,255,255,0.8)';
    
    // Add blur to game canvas
    const canvas = document.getElementById('gameCanvas');
    canvas.style.filter = `blur(${effect.intensity * 10}px) brightness(1.5)`;
  }, phases.blindDuration);
  
  // PHASE 3: RECOVERING (slight impairment)
  setTimeout(() => {
    flashDiv.style.opacity = effect.intensity * 0.2;
    
    // Reduce blur
    const canvas = document.getElementById('gameCanvas');
    canvas.style.filter = `blur(${effect.intensity * 3}px) brightness(1.2)`;
  }, phases.blindDuration + phases.disorientedDuration);
  
  // PHASE 4: NORMAL (remove all effects)
  setTimeout(() => {
    flashDiv.remove();
    const canvas = document.getElementById('gameCanvas');
    canvas.style.filter = '';
  }, effect.duration);
}
```

### 4.4 AUDIO EFFECTS
```javascript
// Play ringing sound when flashed
function playFlashbangAudio(intensity) {
  const ringing = new Audio('/sounds/flashbang_ringing.wav');
  ringing.volume = intensity * 0.7;
  ringing.play();
  
  // Reduce game volume
  if (window.gameAudio) {
    window.gameAudio.volume = 1 - (intensity * 0.8);
    
    // Gradually restore volume
    const restoreInterval = setInterval(() => {
      window.gameAudio.volume = Math.min(1, window.gameAudio.volume + 0.02);
      if (window.gameAudio.volume >= 1) {
        clearInterval(restoreInterval);
      }
    }, 100);
  }
}
```

### 4.5 MOVEMENT IMPAIRMENT
```javascript
// In your input handler
function handleMouseMove(event) {
  let mouseX = event.clientX;
  let mouseY = event.clientY;
  
  // Check if player is flashbanged
  const myPlayer = gameState.players[localPlayerId];
  if (myPlayer?.effectState?.movementImpairment > 0) {
    const impairment = myPlayer.effectState.movementImpairment;
    
    // Reduce sensitivity
    const sensitivityReduction = 1 - (impairment * 0.5);
    mouseX = lastMouseX + (mouseX - lastMouseX) * sensitivityReduction;
    mouseY = lastMouseY + (mouseY - lastMouseY) * sensitivityReduction;
    
    // Add random jitter
    if (Math.random() < impairment * 0.3) {
      mouseX += (Math.random() - 0.5) * 10;
      mouseY += (Math.random() - 0.5) * 10;
    }
  }
  
  // Use adjusted mouse position
  updateAimDirection(mouseX, mouseY);
}
```

---

## PART 5: VISION INTEGRATION

### 5.1 SMOKE BLOCKS VISION
The backend already handles this! Your vision polygon in `gameState.vision.polygon` is automatically clipped where smoke blocks sight. You don't need to do anything special.

**Vision Blocking Parameters:**
- Smoke opacity: 95% at center, 50% at edges
- Vision blocked when cumulative opacity reaches 50%
- More aggressive opacity accumulation (0.3 per sample)
- Effectively blocks vision through the smoke cloud

### 5.2 RENDERING WITH VISION
```javascript
function renderGame(ctx, gameState) {
  // 1. Clear screen
  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // 2. Set up vision clipping
  if (gameState.vision?.polygon) {
    ctx.save();
    ctx.beginPath();
    for (let i = 0; i < gameState.vision.polygon.length; i++) {
      const point = gameState.vision.polygon[i];
      if (i === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    }
    ctx.closePath();
    ctx.clip();
  }
  
  // 3. Render everything inside vision
  renderTerrain(ctx);
  renderWalls(ctx);
  renderPlayers(ctx);
  renderProjectiles(ctx);
  
  // 4. Restore context
  if (gameState.vision?.polygon) {
    ctx.restore();
  }
  
  // 5. Render smoke ON TOP (so it's always visible)
  renderSmoke(ctx, gameState);
  
  // 6. Render fog of war
  renderFogOfWar(ctx, gameState.vision);
}
```

---

## PART 6: WEAPON STATS

### SMOKE GRENADE
- **Type**: 'smokegrenade'
- **Max Ammo**: 2
- **Damage**: 0 (no damage)
- **Fuse Time**: 2000ms (2 seconds)
- **Smoke Duration**: 15000ms (15 seconds)
- **Smoke Radius**: 60 pixels
- **Expansion Time**: 1500ms (1.5 seconds)
- **Max Opacity**: 0.95 (95% at center, 50% at edges)
- **Throw Speed**: 20 (same as frag grenade)

### FLASHBANG
- **Type**: 'flashbang'
- **Max Ammo**: 2
- **Damage**: 0 (no damage)
- **Fuse Time**: 1500ms (1.5 seconds)
- **Effect Radius**: 120 pixels
- **Max Effect Duration**: 4000ms (4 seconds)
- **Through-wall effect**: 10% intensity (minimal)
- **Looking away reduction**: 90% reduction when not looking directly
- **No effect if**: Looking > 90° away OR final intensity < 15%
- **Throw Speed**: 20 (same as frag grenade)

---

## PART 7: COMPLETE EXAMPLE

```javascript
// Initialize smoke system
const smokeSystem = new SmokeParticleSystem();

// Listen for game state
socket.on('game:state', (gameState) => {
  // Update smoke particles
  if (gameState.smokeZones) {
    // Create particles for new smoke zones
    for (const smoke of gameState.smokeZones) {
      if (!smokeSystem.hasParticlesFor(smoke.id)) {
        smokeSystem.createSmokeCloud(smoke);
      }
    }
    smokeSystem.update(gameState.smokeZones);
  }
  
  // Render game
  renderGame(ctx, gameState);
});

// Listen for flashbang effects
socket.on('FLASHBANG_EFFECT', (data) => {
  const myEffect = data.affectedPlayers.find(p => p.playerId === localPlayerId);
  if (myEffect) {
    applyFlashbang(myEffect);
    playFlashbangAudio(myEffect.intensity);
  }
});

// Equip tactical grenades
socket.emit('weapon:equip', {
  primary: 'rifle',
  secondary: 'pistol',
  support: ['smokegrenade', 'flashbang']
});

// Switch and throw
function throwSmoke() {
  socket.emit('weapon:switch', {
    toWeapon: 'smokegrenade',
    fromWeapon: currentWeapon
  });
  
  setTimeout(() => {
    socket.emit('weapon:fire', {
      weaponType: 'smokegrenade',
      position: { x: player.x, y: player.y },
      direction: aimAngle,
      isADS: false,
      timestamp: Date.now(),
      sequence: seq++,
      chargeLevel: 3
    });
  }, 100);
}
```

---

## CRITICAL NOTES

1. **SMOKE ZONES ARE IN EVERY GAME STATE** - Check `gameState.smokeZones` array
2. **FLASHBANG IS A ONE-TIME EVENT** - Listen for 'FLASHBANG_EFFECT' event
3. **NO DRIFT** - Smoke stays exactly where thrown, ignore wind fields
4. **VISION ALREADY CLIPPED** - The polygon already accounts for smoke blocking
5. **USE 'game:state' EVENT** - Not 'gameState', it's 'game:state'
6. **WEAPONS MUST BE EQUIPPED FIRST** - Use weapon:equip before switching
7. **CHARGE LEVEL AFFECTS THROW DISTANCE** - 0-5, higher = farther

---

## WHAT TO BUILD

### MINIMUM VIABLE:
1. Gray circles for smoke that grow and fade
2. White screen flash that fades over time
3. Show smoke zones from gameState.smokeZones

### BETTER VERSION:
1. Particle-based smoke clouds
2. Progressive blur/brightness for flashbang phases
3. Audio effects (ringing, muffled sounds)
4. Movement impairment (reduced sensitivity)

### TEST IT:
1. Equip smokegrenade in loadout
2. Switch to smokegrenade
3. Throw it with weapon:fire
4. Watch for smoke zone in game state
5. See smoke appear and block vision
6. Wait 15 seconds for it to disappear

THE BACKEND IS 100% WORKING - YOU JUST NEED TO RENDER IT!
