# 🎮 Frontend Vision System Implementation Guide

## 📋 Overview

The backend now implements a **server-authoritative fog of war vision system**. Each player only receives game state data for entities they can actually see. The frontend needs to:

1. **Render fog of war overlay** to hide unseen areas
2. **Handle filtered player data** (only visible players sent)
3. **Track last seen positions** for tactical gameplay
4. **Render vision edges** smoothly with proper aesthetics

## 🎯 What Backend Provides

### 1. **Filtered Game State** (every 50ms)
```typescript
// You now receive ONLY visible entities
{
  players: Map<string, PlayerState>,    // Only visible players + self
  projectiles: ProjectileState[],        // Only visible projectiles + own
  walls: Map<string, WallState>,         // All walls (you filter client-side)
  timestamp: number,
  tickRate: number
}
```

### 2. **Vision Rules Implemented**
- **Main vision cone**: 120° forward arc, 100px range
- **Peripheral vision**: 30px radius circle (except 90° blind spot behind)
- **Extended vision**: Extra 30% range in mouse direction (30° cone)
- **Wall blocking**: Destroyed wall sections allow sight through
- **Update frequency**: Recalculated when player moves >2px or rotates >5°

## 🔧 Required Frontend Changes

### 1. **Fog of War Rendering**

Create a vision mask texture that covers non-visible areas:

```typescript
// VisionRenderer.ts
export class VisionRenderer {
  private visionTexture: PIXI.RenderTexture;
  private maskGraphics: PIXI.Graphics;
  
  constructor(width: number, height: number) {
    this.visionTexture = PIXI.RenderTexture.create({
      width: 480,
      height: 270
    });
    this.maskGraphics = new PIXI.Graphics();
  }
  
  updateVision(playerPos: Vector2, rotation: number, walls: WallState[]) {
    // Clear previous vision
    this.maskGraphics.clear();
    
    // Draw main vision cone (120° forward)
    this.drawVisionCone(playerPos, rotation, 120, 100);
    
    // Draw peripheral vision (30px radius, exclude 90° behind)
    this.drawPeripheralVision(playerPos, rotation, 30);
    
    // Draw extended mouse vision (30° cone, 130px range)
    this.drawMouseVision(playerPos, mouseAngle, 30, 130);
    
    // Apply to fog overlay
    this.applyFogMask();
  }
}
```

### 2. **Player Visibility Handling**

Players will appear/disappear from your game state. Handle this smoothly:

```typescript
// PlayerManager.ts
export class PlayerManager {
  private visiblePlayers: Map<string, PlayerSprite> = new Map();
  private lastSeenPositions: Map<string, LastSeenData> = new Map();
  
  updatePlayers(serverPlayers: Map<string, PlayerState>) {
    // Remove players no longer visible
    for (const [id, sprite] of this.visiblePlayers) {
      if (!serverPlayers.has(id)) {
        this.handlePlayerDisappear(id, sprite);
      }
    }
    
    // Add/update visible players
    for (const [id, state] of serverPlayers) {
      if (this.visiblePlayers.has(id)) {
        this.updatePlayer(id, state);
      } else {
        this.handlePlayerAppear(id, state);
      }
    }
  }
  
  private handlePlayerDisappear(id: string, sprite: PlayerSprite) {
    // Store last seen position
    this.lastSeenPositions.set(id, {
      position: sprite.position.clone(),
      timestamp: Date.now(),
      fadeStarted: false
    });
    
    // Start fade out animation
    this.fadeOutPlayer(sprite);
  }
}
```

### 3. **Last Seen Positions**

Show ghosted indicators where enemies were last spotted:

```typescript
interface LastSeenData {
  position: Vector2;
  timestamp: number;
  fadeStarted: boolean;
}

// Render semi-transparent "ghost" at last position
// Fade out after 2-3 seconds
// Show "?" marker or footprint icon
```

### 4. **Audio Without Vision**

**CRITICAL**: You'll still receive audio events for non-visible players!

```typescript
// The backend sends audio events globally
// Use these to show sound indicators even when player isn't visible
handleGunshot(event: AudioEvent) {
  if (!this.isPlayerVisible(event.playerId)) {
    this.showSoundIndicator(event.position, event.volume);
  }
}
```

## 🎨 Visual Design Requirements

### 1. **Fog of War Appearance**
- **Unexplored**: Solid black or dark gray
- **Previously seen**: Darker overlay (show static map features)
- **Currently visible**: No overlay
- **Edge transition**: Soft gradient or dithered pattern

### 2. **Vision Edge Effects**
```typescript
// Example shader for vision edges
const fogShader = `
  // Smooth transition at vision boundaries
  float edge = smoothstep(0.9, 1.0, distance);
  color = mix(color, fogColor, edge);
`;
```

### 3. **Player Appearance/Disappearance**
- **Appear**: Quick fade-in (100-200ms)
- **Disappear**: Store position, show ghost marker
- **Ghost decay**: Fade out over 2-3 seconds

## 🚀 Implementation Steps

### Step 1: Basic Fog Rendering
1. Create fog overlay covering entire screen
2. Cut out visible areas based on player position
3. Test with static 120° cone

### Step 2: Advanced Vision Shapes
1. Add peripheral vision circle
2. Add mouse-direction extension
3. Add blind spot behind player

### Step 3: Wall Occlusion
1. Cast rays from player to vision edge
2. Stop rays when hitting intact wall sections
3. Allow rays through destroyed sections

### Step 4: Player Management
1. Handle players appearing/disappearing
2. Implement last seen positions
3. Add ghost markers

### Step 5: Polish
1. Smooth vision edges
2. Add particle effects at vision boundary
3. Optimize rendering performance

## 📊 Testing Scenarios

1. **Two players facing each other** → Both should see each other
2. **Player turns 180°** → Other player disappears (in blind spot)
3. **Players separated by wall** → Cannot see through
4. **Destroy wall section** → Can now see through gap
5. **Player at edge of vision** → Should flicker in/out smoothly

## 🔍 Debug Helpers

Add debug mode to visualize vision mechanics:

```typescript
if (DEBUG_VISION) {
  // Draw vision cone outline
  graphics.lineStyle(1, 0xff0000);
  graphics.drawCone(position, rotation, 120, 100);
  
  // Draw peripheral circle
  graphics.lineStyle(1, 0x00ff00);
  graphics.drawCircle(position.x, position.y, 30);
  
  // Show blind spot
  graphics.fillStyle(0xff0000, 0.3);
  graphics.drawArc(position, rotation + 180, 45);
}
```

## ⚠️ Common Pitfalls

1. **Don't trust client vision** - Server already filtered, don't filter again
2. **Don't hide own player** - You always see yourself
3. **Audio still arrives** - Show sound indicators for non-visible events
4. **Smooth transitions** - Avoid pop-in/pop-out

## 📈 Performance Tips

1. **Cache vision calculations** - Only recalculate when player moves/rotates significantly
2. **Use render textures** - Don't recalculate fog every frame
3. **LOD for distant areas** - Reduce detail in fog
4. **Batch ray casts** - Group visibility checks

## 🎮 Example Integration

```typescript
// In your game update loop
update(delta: number) {
  // Update player from filtered server state
  const serverState = this.latestServerState;
  
  // Update visible players
  this.playerManager.updatePlayers(serverState.players);
  
  // Update vision mask
  if (this.localPlayer) {
    this.visionRenderer.updateVision(
      this.localPlayer.position,
      this.localPlayer.rotation,
      serverState.walls
    );
  }
  
  // Update fog overlay
  this.fogOverlay.mask = this.visionRenderer.getMask();
}
```

## 🔗 Backend Events

No new events needed! The filtered game state automatically handles visibility. Just process the normal `game:state` event with the understanding that you're only receiving visible entities.

## 📞 Questions?

The vision system is designed to be **server-authoritative** to prevent cheating. The backend handles all visibility calculations. Your job is to create a beautiful, smooth visualization of what the backend determined is visible.

Key principle: **The backend decides WHAT you see, the frontend decides HOW you see it.** 