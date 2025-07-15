# 🔥 DESTRUCTION & VISION IMPLEMENTATION GUIDE

## 🧱 Wall Destruction System

### Core Concept
Each wall is divided into 5 vertical slices (15 pixels wide at 480x270 resolution). Each slice can be:
- **Intact**: Full health, blocks vision/movement
- **Damaged**: Visible cracks, still blocks but with bullet holes
- **Destroyed**: Removed, allows movement and full vision

### Implementation

```typescript
// src/client/entities/DestructibleWall.ts
export class DestructibleWall extends Phaser.GameObjects.Container {
  private slices: WallSlice[] = [];
  private sliceWidth = 15; // pixels per slice
  private wallTexture: Phaser.GameObjects.RenderTexture;
  private destructionMask: Uint8Array;
  
  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);
    
    // Initialize 5 slices
    this.destructionMask = new Uint8Array(5);
    this.destructionMask.fill(100); // 100 = full health
    
    // Create render texture for dynamic wall appearance
    this.wallTexture = scene.add.renderTexture(0, 0, 75, 48);
    this.add(this.wallTexture);
    
    this.redrawWall();
  }
  
  takeDamage(localX: number, damage: number, damageType: 'bullet' | 'explosive') {
    const sliceIndex = Math.floor(localX / this.sliceWidth);
    
    if (damageType === 'bullet') {
      // Bullets damage single slice
      this.destructionMask[sliceIndex] -= damage;
      
      // Create bullet hole visual
      if (this.destructionMask[sliceIndex] > 0) {
        this.createBulletHole(localX);
      }
    } else {
      // Explosives damage multiple slices
      for (let i = 0; i < 5; i++) {
        const distance = Math.abs(i - sliceIndex);
        const falloffDamage = damage * Math.max(0, 1 - distance * 0.3);
        this.destructionMask[i] -= falloffDamage;
      }
    }
    
    // Clamp values
    for (let i = 0; i < 5; i++) {
      this.destructionMask[i] = Math.max(0, this.destructionMask[i]);
    }
    
    this.redrawWall();
    this.updatePhysics();
  }
  
  private redrawWall() {
    this.wallTexture.clear();
    
    for (let i = 0; i < 5; i++) {
      const health = this.destructionMask[i];
      const x = i * this.sliceWidth;
      
      if (health > 75) {
        // Intact
        this.wallTexture.drawFrame('walls', 'intact', x, 0);
      } else if (health > 25) {
        // Damaged
        this.wallTexture.drawFrame('walls', 'damaged', x, 0);
      } else if (health > 0) {
        // Heavily damaged
        this.wallTexture.drawFrame('walls', 'critical', x, 0);
      }
      // else: destroyed (draw nothing)
    }
  }
  
  hasHoleAt(worldX: number, worldY: number): boolean {
    const localX = worldX - this.x;
    const sliceIndex = Math.floor(localX / this.sliceWidth);
    return this.destructionMask[sliceIndex] === 0;
  }
  
  hasBulletHoleAt(worldX: number, worldY: number): boolean {
    // Check if there's a bullet hole at this position
    return this.bulletHoles.some(hole => 
      Math.abs(hole.x - worldX) < 2 && Math.abs(hole.y - worldY) < 2
    );
  }
}
```

## 👁️ Vision System

### Core Concept
- Base fog of war covers entire screen
- Player has circular vision radius
- Vision can pass through destroyed wall sections
- Small light leaks through bullet holes
- Large light floods through destroyed sections

### Implementation

```typescript
// src/client/systems/VisionSystem.ts
export class VisionSystem implements IGameSystem {
  private scene: Phaser.Scene;
  private fogTexture: Phaser.GameObjects.RenderTexture;
  private lightMasks: Map<string, Phaser.GameObjects.Image> = new Map();
  
  async initialize(scene: Phaser.Scene) {
    this.scene = scene;
    
    // Create fog overlay (full screen)
    this.fogTexture = scene.add.renderTexture(0, 0, 480, 270);
    this.fogTexture.fill(0x000000, 0.9); // Dark fog
    this.fogTexture.setDepth(1000); // Above everything
    
    // Create light masks
    this.createLightMasks();
  }
  
  private createLightMasks() {
    // Player vision circle (large)
    const playerLight = this.scene.make.image({
      key: 'lights',
      frame: 'player_vision',
      add: false
    });
    this.lightMasks.set('player', playerLight);
    
    // Bullet hole light (tiny)
    const bulletLight = this.scene.make.image({
      key: 'lights',
      frame: 'bullet_hole',
      add: false
    });
    this.lightMasks.set('bullet', bulletLight);
    
    // Destroyed section light (medium)
    const destroyedLight = this.scene.make.image({
      key: 'lights',
      frame: 'destroyed_section',
      add: false
    });
    this.lightMasks.set('destroyed', destroyedLight);
  }
  
  update(player: Player, walls: DestructibleWall[]) {
    // Clear fog
    this.fogTexture.fill(0x000000, 0.9);
    
    // Draw player's main vision
    this.drawLight(player.x, player.y, 'player');
    
    // Cast rays to find vision extensions through walls
    this.castVisionRays(player, walls);
  }
  
  private castVisionRays(player: Player, walls: DestructibleWall[]) {
    const rayCount = 180; // One ray every 2 degrees
    const maxDistance = 100;
    
    for (let i = 0; i < rayCount; i++) {
      const angle = (i / rayCount) * Math.PI * 2;
      const dx = Math.cos(angle);
      const dy = Math.sin(angle);
      
      // Cast ray
      for (let dist = 0; dist < maxDistance; dist += 2) {
        const x = player.x + dx * dist;
        const y = player.y + dy * dist;
        
        // Check wall collision
        const wall = this.getWallAt(x, y, walls);
        if (wall) {
          // Check for holes
          if (wall.hasHoleAt(x, y)) {
            // Draw light flood through hole
            this.drawLight(x, y, 'destroyed');
            
            // Continue ray with reduced intensity
            this.castSecondaryRay(x, y, angle, maxDistance - dist);
            break;
          } else if (wall.hasBulletHoleAt(x, y)) {
            // Draw small light leak
            this.drawLight(x, y, 'bullet');
            
            // Ray stops here but shows tiny vision cone
            this.drawNarrowVisionCone(x, y, angle);
            break;
          } else {
            // Ray blocked by solid wall
            break;
          }
        }
      }
    }
  }
  
  private drawLight(x: number, y: number, type: string) {
    const light = this.lightMasks.get(type);
    if (!light) return;
    
    // Position light mask
    light.setPosition(x, y);
    
    // Draw with subtractive blending to cut through fog
    this.fogTexture.erase(light);
  }
  
  private drawNarrowVisionCone(x: number, y: number, angle: number) {
    // Draw a narrow 15-degree cone through bullet hole
    const coneLength = 30;
    const coneWidth = 15 * (Math.PI / 180);
    
    const points = [];
    points.push(new Phaser.Geom.Point(x, y));
    
    for (let a = -coneWidth/2; a <= coneWidth/2; a += coneWidth/4) {
      const px = x + Math.cos(angle + a) * coneLength;
      const py = y + Math.sin(angle + a) * coneLength;
      points.push(new Phaser.Geom.Point(px, py));
    }
    
    // Create polygon and erase from fog
    const poly = new Phaser.Geom.Polygon(points);
    this.fogTexture.erase(poly);
  }
}
```

## 🎨 Visual Assets Needed

### Wall Sprites (15x48 pixels each)
- `intact.png` - Full health wall slice
- `damaged.png` - Cracked wall with bullet marks
- `critical.png` - Heavily damaged, about to break
- `destroyed.png` - Rubble/debris (optional)

### Light Masks (Gradients)
- `player_vision.png` - 128x128 radial gradient
- `bullet_hole.png` - 8x8 small gradient
- `destroyed_section.png` - 32x32 medium gradient

### Example Light Mask Creation (Photoshop/GIMP)
1. Create new image (128x128 for player vision)
2. Fill with black
3. Select radial gradient tool
4. Gradient: White center to transparent edge
5. Draw from center outward
6. Save as PNG with transparency

## 🔄 Network Synchronization

```typescript
// Server-side wall state
interface WallSync {
  id: string;
  destructionMask: number[]; // Array of 5 health values
  bulletHoles: Array<{x: number, y: number}>;
}

// Client receives update
socket.on('wallUpdate', (data: WallSync) => {
  const wall = walls.get(data.id);
  wall.setDestructionMask(data.destructionMask);
  wall.setBulletHoles(data.bulletHoles);
  wall.redraw();
});

// Client sends damage event
socket.emit('damageWall', {
  wallId: wall.id,
  localX: hitPoint.x,
  damage: weapon.damage,
  damageType: weapon.type
});
```

## 🎯 Performance Tips

1. **Batch Vision Updates**: Only recalculate vision every 3-5 frames
2. **Spatial Hashing**: Only check nearby walls for ray intersection
3. **LOD System**: Reduce ray count for distant players
4. **Texture Caching**: Pre-render common wall states
5. **Delta Compression**: Only send changed destruction values

## 🐛 Common Issues & Solutions

### Issue: Vision flickers
**Solution**: Use double buffering for fog texture
```typescript
private fogTextures: Phaser.GameObjects.RenderTexture[] = [];
private activeBuffer = 0;

update() {
  // Swap buffers
  this.activeBuffer = 1 - this.activeBuffer;
  const currentFog = this.fogTextures[this.activeBuffer];
  // Render to currentFog...
}
```

### Issue: Bullet holes don't align
**Solution**: Store holes in wall-local coordinates
```typescript
// Convert world to local coordinates
const localX = worldX - wall.x;
const localY = worldY - wall.y;
wall.addBulletHole(localX, localY);
```

### Issue: Performance drops with many walls
**Solution**: Use quadtree for spatial queries
```typescript
const quadtree = new Phaser.Structs.QuadTree(0, 0, 480, 270);
walls.forEach(wall => quadtree.insert(wall));
const nearbyWalls = quadtree.retrieve(player.getBounds());
```

## 🚀 Testing Individual Systems

```typescript
// Test destruction without full game
const testWall = new DestructibleWall(scene, 240, 135);
testWall.takeDamage(20, 30, 'bullet');
console.assert(testWall.hasHoleAt(240 + 20, 135) === false);

// Test vision without multiplayer
const visionSystem = new VisionSystem();
await visionSystem.initialize(scene);
visionSystem.update(mockPlayer, [testWall]);
```

This implementation provides the exact destruction and vision mechanics you described, optimized for AI-assisted development! 