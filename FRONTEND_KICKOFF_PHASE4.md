# 🎮 FRONTEND KICKOFF PROMPT: Phase 4 - Multiplayer Visibility & Collisions

## 📋 Context

You are implementing the frontend visualization for a multiplayer 2D top-down pixel art shooter called "Trespasser". The game runs at 480x270 resolution with 2-8 players. The backend team is implementing:
- Player-wall collision detection
- Fog of war vision calculations
- Filtered player visibility based on line-of-sight

Your frontend already has:
- ✅ Player movement controls (WASD + mouse)
- ✅ Local player rendering
- ✅ Wall rendering and destruction
- ✅ Socket.io connection to backend

## 🎯 Your Role

You are an expert game frontend developer specializing in real-time multiplayer visualization. You excel at creating responsive, visually appealing game clients that provide excellent player feedback while maintaining synchronization with authoritative servers.

## 🎮 Objective

Implement three interconnected visualization systems:
1. **Multiplayer Player Rendering** - Show other players based on visibility
2. **Fog of War Rendering** - Visualize areas outside line-of-sight
3. **Smooth Collision Feedback** - Visual response to collision events

## 📐 Technical Specifications

### Rendering Constants
- Base resolution: 480x270 (scaled to screen)
- Pixel perfect rendering required
- Target FPS: 60+ 
- Max players to render: 8
- Fog of war: Black or dark gray overlay

### Backend Events You'll Receive

```typescript
// Game state from backend
interface GameState {
  visiblePlayers: PlayerState[];  // Only players you can see
  recentlyVisiblePlayers: {        // Players seen in last 2 seconds  
    player: PlayerState;
    lastSeenTimestamp: number;
  }[];
  walls: WallState[];              // All walls (for now)
  visionMask?: number[];           // Optional: Bit array of visible pixels
}

// Collision event from backend
interface CollisionEvent {
  playerId: string;
  position: Vector2;               // Corrected position after collision
  velocity: Vector2;               // Updated velocity
}

// Player state structure
interface PlayerState {
  id: string;
  position: Vector2;
  angle: number;
  team: 'red' | 'blue';
  health: number;
  weaponType: string;
  movementState: 'idle' | 'walking' | 'running' | 'sneaking';
}
```

## 🛠️ Implementation Requirements

### 1. Multiplayer Player Rendering

#### Task
Render other players received in the visiblePlayers array with smooth interpolation.

#### Approach
- Create player sprites for each visible player (different colors per team)
- Interpolate positions between network updates (20Hz → 60Hz)
- Show player rotation based on their angle
- Implement smooth fade-in when players become visible
- Show "ghost" sprites for recentlyVisiblePlayers (semi-transparent)

#### Visual Features
- Team colors: Red vs Blue (or other distinct colors)
- Player names above sprites (if space permits at 480x270)
- Weapon indicator (what they're holding)
- Simple health bar (if visible in game state)
- Smooth rotation for aiming direction

### 2. Fog of War Visualization

#### Task
Create a fog overlay that obscures areas outside player's line of sight.

#### Approach
- Create a 480x270 render texture for fog
- Start with simple radius-based fog, upgrade when backend sends visionMask
- Use alpha blending: 0 = fully visible, 0.9 = heavily obscured
- Smooth fog edges with gradient (not hard cutoff)
- Update fog when player moves or walls are destroyed

#### Rendering Options
- **Option A**: Canvas-based fog (easier, good performance at low res)
- **Option B**: WebGL shader fog (smoother, more effects possible)
- **Option C**: Tilemap overlay (fastest, less smooth)
Choose based on your renderer (Phaser/PixiJS/custom)

### 3. Collision Feedback

#### Task
Provide visual feedback when player collision occurs without feeling "stuck".

#### Approach
- Smooth position correction when backend sends collision update
- Small "bump" animation or particle effect on collision
- Screen shake for high-speed collisions (optional)
- Prevent jittery movement by interpolating corrections
- Sound effect for collision feedback (footstep stumble)

#### Quality of Life
- Slide along walls instead of hard stop (backend handles physics)
- Corner cutting assistance (backend provides corrected path)
- Visual indicator when trying to move through walls
- No camera jitter during collisions

## 📦 Deliverables

1. **PlayerRenderer.ts** - Multiplayer player sprite management
2. **FogOfWarRenderer.ts** - Vision/fog overlay system
3. **InterpolationSystem.ts** - Smooth position updates between network frames
4. **CollisionFeedback.ts** - Visual collision response
5. **Assets needed**: Player sprites (red/blue), fog texture, collision effects

## ✅ Performance Requirements

- Maintain 60 FPS with 8 players visible
- Fog updates under 5ms per frame
- Minimal memory allocation per frame
- Efficient sprite batching for all players
- Smooth interpolation without overshooting

## 🎨 Visual Guidelines

- Pixel art style: No anti-aliasing, sharp pixels
- Clear team differentiation (colorblind friendly)
- Fog should enhance atmosphere, not frustrate
- Collision feedback should feel responsive, not punishing
- Recently seen enemies as "ghosts" add tactical value

## ⚠️ Edge Cases to Handle

- Player spawning (fade in, no fog pop)
- Multiple players in same spot (slight offset for visibility)
- Network lag (extrapolate positions carefully)
- Fog update during explosions/destruction
- Player disconnection (graceful fade out)

## 🧪 Testing Checklist

- [ ] Open two browser tabs, verify you see other player
- [ ] Verify fog hides players behind walls
- [ ] Test collision feedback feels smooth
- [ ] Check performance with 8 players
- [ ] Verify no visual glitches during destruction
- [ ] Test with artificial network lag (Chrome DevTools)

## 💻 Code Examples

```javascript
// Interpolation example
class InterpolationSystem {
  interpolatePosition(
    current: Vector2, 
    target: Vector2, 
    deltaTime: number
  ): Vector2 {
    const factor = 1 - Math.pow(0.01, deltaTime);
    return {
      x: current.x + (target.x - current.x) * factor,
      y: current.y + (target.y - current.y) * factor
    };
  }
}

// Fog of war simple implementation
class FogOfWarRenderer {
  updateFog(playerPos: Vector2, visionRadius: number) {
    // Clear fog around player
    this.fogGraphics.clear();
    this.fogGraphics.fillStyle(0x000000, 0.8);
    this.fogGraphics.fillRect(0, 0, 480, 270);
    
    // Cut out visible area
    this.fogGraphics.beginPath();
    this.fogGraphics.arc(playerPos.x, playerPos.y, visionRadius);
    this.fogGraphics.fill();
  }
}
```

## 💡 Remember

The backend is authoritative. Your role is to make the game feel responsive and look great while respecting server state. When in doubt, favor smooth visuals over perfect accuracy - the 50ms network delay is more noticeable than small position discrepancies.

## 🚀 Getting Started

1. Set up player sprite pool for multiplayer rendering
2. Implement basic interpolation system
3. Add fog of war overlay
4. Test with multiple browser tabs
5. Polish with effects and transitions 