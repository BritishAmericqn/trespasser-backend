# 🗺️ LEVEL FORMAT SPECIFICATION

## Overview
Tile-based level format optimized for:
- Hand-crafted maps
- Clear destructible/indestructible differentiation
- Efficient network transmission
- Easy editing in tools like Tiled

## Level File Format (.json)

### shared/types/level.ts
```typescript
export interface LevelData {
  // Metadata
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
  
  // Map dimensions
  width: number;  // in tiles
  height: number; // in tiles
  tileSize: number; // pixels per tile (default: 32)
  
  // Layers
  layers: Layer[];
  
  // Tilesets
  tilesets: Tileset[];
  
  // Spawn points
  spawns: SpawnPoint[];
  
  // Game objects
  objects: GameObject[];
  
  // Environment
  lighting: LightingConfig;
  audio: AudioConfig;
}

export interface Layer {
  id: string;
  name: string;
  type: 'floor' | 'walls' | 'decoration' | 'collision';
  visible: boolean;
  opacity: number;
  data: number[]; // Flattened 2D array of tile indices
}

export interface Tileset {
  name: string;
  firstGid: number; // First global ID
  image: string;    // Path to image
  tileWidth: number;
  tileHeight: number;
  tileCount: number;
  columns: number;
  
  // Tile properties
  tiles: TileProperties[];
}

export interface TileProperties {
  id: number; // Local tile ID
  type: TileType;
  material: WallMaterial;
  health?: number;
  destructible: boolean;
  bulletPenetration: number; // 0-1
  explosionResistance: number; // 0-1
  customProperties?: Record<string, any>;
}

export enum TileType {
  EMPTY = 'empty',
  FLOOR = 'floor',
  WALL = 'wall',
  WINDOW = 'window',
  DOOR = 'door',
  SPAWN = 'spawn',
  OBJECTIVE = 'objective'
}

export interface SpawnPoint {
  id: string;
  team: 'red' | 'blue' | 'neutral';
  position: Vector2;
  radius: number;
  priority: number; // For spawn selection
}

export interface GameObject {
  id: string;
  type: 'weapon' | 'ammo' | 'health' | 'armor' | 'objective';
  position: Vector2;
  properties: Record<string, any>;
}

export interface LightingConfig {
  ambientColor: string; // Hex color
  ambientIntensity: number; // 0-1
  shadows: boolean;
  fogOfWar: boolean;
}

export interface AudioConfig {
  ambientSound?: string;
  reverbType: 'none' | 'small' | 'medium' | 'large';
  volume: number; // 0-1
}
```

## Example Level File

### assets/maps/warehouse.json
```json
{
  "id": "warehouse_01",
  "name": "Abandoned Warehouse",
  "version": "1.0.0",
  "author": "LevelDesigner",
  "description": "Close quarters combat in an abandoned warehouse",
  
  "width": 30,
  "height": 20,
  "tileSize": 32,
  
  "layers": [
    {
      "id": "floor",
      "name": "Floor Layer",
      "type": "floor",
      "visible": true,
      "opacity": 1.0,
      "data": [
        1, 1, 1, 1, 1, 1, 1, 1, 1, 1, ...
      ]
    },
    {
      "id": "walls",
      "name": "Wall Layer",
      "type": "walls",
      "visible": true,
      "opacity": 1.0,
      "data": [
        10, 11, 11, 11, 11, 11, 11, 11, 11, 12,
        13, 0,  0,  0,  0,  0,  0,  0,  0,  14,
        13, 0,  0,  20, 21, 21, 22, 0,  0,  14,
        ...
      ]
    }
  ],
  
  "tilesets": [
    {
      "name": "warehouse_tiles",
      "firstGid": 1,
      "image": "assets/tilesets/warehouse.png",
      "tileWidth": 32,
      "tileHeight": 32,
      "tileCount": 64,
      "columns": 8,
      "tiles": [
        {
          "id": 0,
          "type": "empty",
          "material": "none",
          "destructible": false,
          "bulletPenetration": 1.0,
          "explosionResistance": 0.0
        },
        {
          "id": 1,
          "type": "floor",
          "material": "concrete",
          "destructible": false,
          "bulletPenetration": 0.0,
          "explosionResistance": 1.0
        },
        {
          "id": 10,
          "type": "wall",
          "material": "concrete",
          "health": 100,
          "destructible": true,
          "bulletPenetration": 0.1,
          "explosionResistance": 0.7
        },
        {
          "id": 20,
          "type": "wall",
          "material": "wood",
          "health": 50,
          "destructible": true,
          "bulletPenetration": 0.3,
          "explosionResistance": 0.3
        },
        {
          "id": 30,
          "type": "wall",
          "material": "metal",
          "health": 200,
          "destructible": false,
          "bulletPenetration": 0.0,
          "explosionResistance": 0.9
        }
      ]
    }
  ],
  
  "spawns": [
    {
      "id": "red_spawn_1",
      "team": "red",
      "position": { "x": 96, "y": 96 },
      "radius": 32,
      "priority": 1
    },
    {
      "id": "blue_spawn_1",
      "team": "blue",
      "position": { "x": 864, "y": 544 },
      "radius": 32,
      "priority": 1
    }
  ],
  
  "objects": [
    {
      "id": "weapon_rifle_1",
      "type": "weapon",
      "position": { "x": 480, "y": 320 },
      "properties": {
        "weaponType": "rifle",
        "ammo": 30,
        "respawnTime": 30
      }
    }
  ],
  
  "lighting": {
    "ambientColor": "#404040",
    "ambientIntensity": 0.3,
    "shadows": true,
    "fogOfWar": true
  },
  
  "audio": {
    "ambientSound": "warehouse_ambient",
    "reverbType": "large",
    "volume": 0.6
  }
}
```

## Level Loading System

### src/client/systems/LevelLoader.ts
```typescript
export class LevelLoader {
  private scene: Phaser.Scene;
  private destructionSystem: DestructionSystem;
  
  async loadLevel(levelPath: string): Promise<Level> {
    // Load JSON
    const levelData: LevelData = await this.loadJSON(levelPath);
    
    // Create level instance
    const level = new Level(levelData);
    
    // Load tilesets
    for (const tileset of levelData.tilesets) {
      await this.loadTileset(tileset);
    }
    
    // Create layers
    this.createLayers(level);
    
    // Create walls with destruction data
    this.createDestructibleWalls(level);
    
    // Create spawn points
    this.createSpawnPoints(level);
    
    // Create game objects
    this.createGameObjects(level);
    
    // Apply lighting
    this.applyLighting(levelData.lighting);
    
    return level;
  }
  
  private createDestructibleWalls(level: Level): void {
    const wallLayer = level.getLayer('walls');
    const tileSize = level.tileSize;
    
    for (let y = 0; y < level.height; y++) {
      for (let x = 0; x < level.width; x++) {
        const tileIndex = wallLayer.data[y * level.width + x];
        
        if (tileIndex > 0) {
          const tileProps = this.getTileProperties(level, tileIndex);
          
          if (tileProps.type === TileType.WALL) {
            const wall = new DestructibleWall(
              this.scene,
              x * tileSize,
              y * tileSize,
              tileSize,
              tileSize,
              {
                material: tileProps.material,
                health: tileProps.health || 100,
                destructible: tileProps.destructible,
                bulletPenetration: tileProps.bulletPenetration,
                explosionResistance: tileProps.explosionResistance
              }
            );
            
            this.destructionSystem.addWall(wall);
          }
        }
      }
    }
  }
  
  private getTileProperties(level: Level, globalTileId: number): TileProperties {
    // Find which tileset this tile belongs to
    for (const tileset of level.tilesets) {
      if (globalTileId >= tileset.firstGid && 
          globalTileId < tileset.firstGid + tileset.tileCount) {
        const localId = globalTileId - tileset.firstGid;
        return tileset.tiles.find(t => t.id === localId) || this.getDefaultTileProperties();
      }
    }
    
    return this.getDefaultTileProperties();
  }
}
```

## Network Optimization

### Level State Sync
```typescript
export interface LevelStateUpdate {
  timestamp: number;
  wallUpdates: WallUpdate[];
  objectUpdates: ObjectUpdate[];
}

export interface WallUpdate {
  x: number; // Tile coordinates
  y: number;
  damage: number;
  holes: BulletHole[];
  destroyed: boolean;
}

export interface ObjectUpdate {
  id: string;
  taken: boolean;
  respawnTime?: number;
}

// Compress level updates
export class LevelStateDelta {
  static compress(updates: WallUpdate[]): Uint8Array {
    // Use bit packing for efficient transmission
    const buffer = new ArrayBuffer(updates.length * 8);
    const view = new DataView(buffer);
    
    updates.forEach((update, i) => {
      const offset = i * 8;
      view.setUint16(offset, update.x);
      view.setUint16(offset + 2, update.y);
      view.setUint8(offset + 4, update.damage);
      view.setUint8(offset + 5, update.holes.length);
      view.setUint8(offset + 6, update.destroyed ? 1 : 0);
    });
    
    return new Uint8Array(buffer);
  }
}
```

## Map Editor Integration

### Tiled Editor Properties
```xml
<!-- Custom properties for Tiled -->
<objecttype name="DestructibleWall" color="#ff0000">
  <property name="material" type="string" default="concrete">
    <choice>concrete</choice>
    <choice>wood</choice>
    <choice>metal</choice>
    <choice>glass</choice>
  </property>
  <property name="health" type="int" default="100"/>
  <property name="destructible" type="bool" default="true"/>
  <property name="bulletPenetration" type="float" default="0.1"/>
  <property name="explosionResistance" type="float" default="0.7"/>
</objecttype>

<objecttype name="SpawnPoint" color="#00ff00">
  <property name="team" type="string" default="neutral">
    <choice>red</choice>
    <choice>blue</choice>
    <choice>neutral</choice>
  </property>
  <property name="priority" type="int" default="1"/>
</objecttype>
```

## Best Practices

1. **Tile Size**: Use 32x32 or 16x16 for optimal memory usage
2. **Layer Organization**: Keep destructible elements on separate layer
3. **Collision Optimization**: Pre-calculate collision masks
4. **Memory Efficiency**: Reuse tile instances where possible
5. **Network Sync**: Only send changed tiles, not entire map

This format provides:
- ✅ Easy hand-crafted map creation
- ✅ Clear destructible/indestructible separation  
- ✅ Efficient storage and transmission
- ✅ Compatible with standard tools (Tiled)
- ✅ Extensible for future features 