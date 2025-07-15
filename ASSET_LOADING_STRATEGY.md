# 📦 ASSET LOADING STRATEGY

## Overview
Optimized asset loading for:
- Fast initial load times
- Memory efficiency  
- Progressive loading
- Texture atlas optimization
- Audio sprite usage

## Asset Organization Strategy

### Texture Atlases
Group sprites by usage pattern to minimize texture switches:

```
src/assets/sprites/
├── atlases/
│   ├── ui.json           # UI elements atlas
│   ├── ui.png
│   ├── players.json      # All player animations
│   ├── players.png
│   ├── walls.json        # Wall types & destruction states
│   ├── walls.png
│   ├── weapons.json      # Weapon sprites & projectiles
│   ├── weapons.png
│   └── effects.json      # Explosions, particles
│       └── effects.png
├── loading/              # Loading screen assets (separate)
│   └── loading-bar.png
└── backgrounds/          # Large images (not atlased)
    └── menu-bg.jpg
```

### Audio Sprites
Combine related sounds to reduce HTTP requests:

```
src/assets/audio/
├── sprites/
│   ├── weapons.json      # All weapon sounds
│   ├── weapons.ogg
│   ├── impacts.json      # Impact/destruction sounds  
│   ├── impacts.ogg
│   ├── movement.json     # Footsteps, movements
│   └── movement.ogg
└── music/
    └── menu-theme.ogg
```

## Asset Loading System

### src/client/systems/AssetLoader.ts
```typescript
import { IGameSystem } from '@client/interfaces/IGameSystem';

export interface AssetManifest {
  preload: AssetGroup[];    // Essential assets
  game: AssetGroup[];       // Game assets
  lazy: AssetGroup[];       // Load on demand
}

export interface AssetGroup {
  key: string;
  type: AssetType;
  url: string | string[];
  data?: any;
}

export enum AssetType {
  IMAGE = 'image',
  ATLAS = 'atlas',
  AUDIO = 'audio',
  AUDIO_SPRITE = 'audioSprite',
  JSON = 'json',
  FONT = 'font'
}

export class AssetLoader implements IGameSystem {
  name = 'AssetLoader';
  dependencies = [];
  
  private scene: Phaser.Scene;
  private manifest: AssetManifest;
  private loadedGroups: Set<string> = new Set();
  private progressCallbacks: Map<string, (progress: number) => void> = new Map();
  
  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.manifest = this.createManifest();
  }
  
  private createManifest(): AssetManifest {
    return {
      preload: [
        // Minimal assets for loading screen
        { key: 'loading-bar', type: AssetType.IMAGE, url: 'assets/sprites/loading/loading-bar.png' },
        { key: 'logo', type: AssetType.IMAGE, url: 'assets/sprites/loading/logo.png' }
      ],
      
      game: [
        // Texture Atlases
        { 
          key: 'players', 
          type: AssetType.ATLAS, 
          url: ['assets/sprites/atlases/players.png', 'assets/sprites/atlases/players.json']
        },
        { 
          key: 'walls', 
          type: AssetType.ATLAS, 
          url: ['assets/sprites/atlases/walls.png', 'assets/sprites/atlases/walls.json']
        },
        { 
          key: 'weapons', 
          type: AssetType.ATLAS, 
          url: ['assets/sprites/atlases/weapons.png', 'assets/sprites/atlases/weapons.json']
        },
        { 
          key: 'effects', 
          type: AssetType.ATLAS, 
          url: ['assets/sprites/atlases/effects.png', 'assets/sprites/atlases/effects.json']
        },
        
        // Audio Sprites
        {
          key: 'weapon-sounds',
          type: AssetType.AUDIO_SPRITE,
          url: ['assets/audio/sprites/weapons.json', 'assets/audio/sprites/weapons.ogg']
        },
        {
          key: 'impact-sounds',
          type: AssetType.AUDIO_SPRITE,
          url: ['assets/audio/sprites/impacts.json', 'assets/audio/sprites/impacts.ogg']
        },
        
        // Game Data
        { key: 'game-config', type: AssetType.JSON, url: 'assets/data/config.json' }
      ],
      
      lazy: [
        // Load these on-demand
        { key: 'menu-bg', type: AssetType.IMAGE, url: 'assets/sprites/backgrounds/menu-bg.jpg' },
        { key: 'menu-music', type: AssetType.AUDIO, url: 'assets/audio/music/menu-theme.ogg' }
      ]
    };
  }
  
  async loadPreloadAssets(): Promise<void> {
    return this.loadAssetGroup('preload', this.manifest.preload);
  }
  
  async loadGameAssets(onProgress?: (progress: number) => void): Promise<void> {
    if (onProgress) {
      this.progressCallbacks.set('game', onProgress);
    }
    
    return this.loadAssetGroup('game', this.manifest.game);
  }
  
  async loadLazyAsset(key: string): Promise<void> {
    const asset = this.manifest.lazy.find(a => a.key === key);
    if (!asset) {
      throw new Error(`Lazy asset not found: ${key}`);
    }
    
    return this.loadAssetGroup(`lazy_${key}`, [asset]);
  }
  
  private async loadAssetGroup(groupName: string, assets: AssetGroup[]): Promise<void> {
    if (this.loadedGroups.has(groupName)) {
      return; // Already loaded
    }
    
    return new Promise((resolve, reject) => {
      // Add assets to loader
      assets.forEach(asset => {
        this.addAssetToLoader(asset);
      });
      
      // Progress tracking
      this.scene.load.on('progress', (value: number) => {
        const callback = this.progressCallbacks.get(groupName);
        if (callback) {
          callback(value);
        }
      });
      
      // Complete handler
      this.scene.load.once('complete', () => {
        this.loadedGroups.add(groupName);
        this.progressCallbacks.delete(groupName);
        resolve();
      });
      
      // Error handler
      this.scene.load.on('loaderror', (file: any) => {
        console.error('Failed to load asset:', file);
        reject(new Error(`Failed to load ${file.key}`));
      });
      
      // Start loading
      this.scene.load.start();
    });
  }
  
  private addAssetToLoader(asset: AssetGroup): void {
    switch (asset.type) {
      case AssetType.IMAGE:
        this.scene.load.image(asset.key, asset.url as string);
        break;
        
      case AssetType.ATLAS:
        const [texture, data] = asset.url as string[];
        this.scene.load.atlas(asset.key, texture, data);
        break;
        
      case AssetType.AUDIO:
        this.scene.load.audio(asset.key, asset.url);
        break;
        
      case AssetType.AUDIO_SPRITE:
        const [jsonUrl, audioUrl] = asset.url as string[];
        this.scene.load.audioSprite(asset.key, jsonUrl, audioUrl);
        break;
        
      case AssetType.JSON:
        this.scene.load.json(asset.key, asset.url as string);
        break;
        
      case AssetType.FONT:
        const [fontTexture, fontData] = asset.url as string[];
        this.scene.load.bitmapFont(asset.key, fontTexture, fontData);
        break;
    }
  }
  
  // Texture atlas helpers
  getFrameNames(atlasKey: string, prefix: string): string[] {
    const texture = this.scene.textures.get(atlasKey);
    if (!texture) return [];
    
    return texture.getFrameNames()
      .filter(name => name.startsWith(prefix))
      .sort();
  }
  
  // Memory management
  unloadAsset(key: string): void {
    if (this.scene.textures.exists(key)) {
      this.scene.textures.remove(key);
    }
    
    if (this.scene.cache.audio.exists(key)) {
      this.scene.cache.audio.remove(key);
    }
    
    if (this.scene.cache.json.exists(key)) {
      this.scene.cache.json.remove(key);
    }
  }
  
  getMemoryUsage(): AssetMemoryInfo {
    const textures = this.scene.textures.list;
    let textureMemory = 0;
    
    for (const key in textures) {
      const texture = textures[key];
      if (texture.source && texture.source[0]) {
        const source = texture.source[0];
        textureMemory += source.width * source.height * 4; // RGBA
      }
    }
    
    return {
      textureMemory,
      audioMemory: this.estimateAudioMemory(),
      totalMemory: textureMemory + this.estimateAudioMemory()
    };
  }
  
  private estimateAudioMemory(): number {
    const audioCache = this.scene.cache.audio;
    let memory = 0;
    
    audioCache.entries.entries.forEach((audio: any) => {
      if (audio.data) {
        memory += audio.data.byteLength || 0;
      }
    });
    
    return memory;
  }
}

interface AssetMemoryInfo {
  textureMemory: number;
  audioMemory: number;
  totalMemory: number;
}
```

## Loading Scene Implementation

### src/client/scenes/LoadingScene.ts
```typescript
export class LoadingScene extends Phaser.Scene {
  private assetLoader: AssetLoader;
  private progressBar: Phaser.GameObjects.Graphics;
  private progressText: Phaser.GameObjects.Text;
  private loadingStage: 'preload' | 'game' = 'preload';
  
  constructor() {
    super({ key: 'LoadingScene' });
  }
  
  preload(): void {
    this.assetLoader = new AssetLoader(this);
    
    // Load minimal assets for loading screen
    this.assetLoader.loadPreloadAssets().then(() => {
      this.createLoadingUI();
      this.loadGameAssets();
    });
  }
  
  private createLoadingUI(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    
    // Logo
    this.add.image(width / 2, height / 2 - 100, 'logo');
    
    // Progress bar background
    this.add.rectangle(width / 2, height / 2, 400, 30, 0x222222);
    
    // Progress bar
    this.progressBar = this.add.graphics();
    
    // Progress text
    this.progressText = this.add.text(width / 2, height / 2 + 40, 'Loading...', {
      fontSize: '20px',
      color: '#ffffff'
    }).setOrigin(0.5);
    
    // Loading tips
    this.showLoadingTips();
  }
  
  private async loadGameAssets(): Promise<void> {
    this.loadingStage = 'game';
    
    try {
      await this.assetLoader.loadGameAssets((progress) => {
        this.updateProgress(progress);
      });
      
      // All assets loaded, start game
      this.scene.start('MenuScene');
    } catch (error) {
      console.error('Failed to load game assets:', error);
      this.showError('Failed to load game assets. Please refresh.');
    }
  }
  
  private updateProgress(value: number): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    
    // Update progress bar
    this.progressBar.clear();
    this.progressBar.fillStyle(0x00ff00, 1);
    this.progressBar.fillRect(
      width / 2 - 195,
      height / 2 - 10,
      390 * value,
      20
    );
    
    // Update text
    this.progressText.setText(`Loading... ${Math.round(value * 100)}%`);
  }
  
  private showLoadingTips(): void {
    const tips = [
      'Aim for weak spots in walls to maximize damage',
      'Different materials have different destruction patterns',
      'Sound travels through holes in walls',
      'Sneaking reduces your movement sound radius'
    ];
    
    const tip = tips[Math.floor(Math.random() * tips.length)];
    
    this.add.text(
      this.cameras.main.width / 2,
      this.cameras.main.height - 50,
      `Tip: ${tip}`,
      { fontSize: '16px', color: '#cccccc' }
    ).setOrigin(0.5);
  }
  
  private showError(message: string): void {
    this.progressText.setText(message).setColor('#ff0000');
  }
}
```

## Texture Atlas Creation

### TexturePacker Configuration
```json
{
  "texturePacker": {
    "textures": {
      "players": {
        "source": "raw-assets/players/**/*.png",
        "settings": {
          "maxWidth": 2048,
          "maxHeight": 2048,
          "algorithm": "MaxRects",
          "padding": 2,
          "extrude": 1,
          "multiPack": true,
          "trim": true,
          "rotateSprites": false
        }
      },
      "walls": {
        "source": "raw-assets/walls/**/*.png",
        "settings": {
          "maxWidth": 1024,
          "maxHeight": 1024,
          "algorithm": "MaxRects",
          "padding": 2,
          "extrude": 1,
          "trim": false
        }
      }
    }
  }
}
```

## Asset Optimization Guidelines

### 1. **Texture Optimization**
```bash
# Optimize PNGs with pngquant
pngquant --quality=85-95 --ext=.png --force assets/**/*.png

# Convert to WebP for modern browsers
for file in assets/**/*.png; do
  cwebp -q 90 "$file" -o "${file%.png}.webp"
done
```

### 2. **Audio Optimization**
```bash
# Convert to OGG for web
ffmpeg -i input.wav -c:a libvorbis -q:a 4 output.ogg

# Create audio sprites with audiosprite
audiosprite --format ogg --output weapons sounds/rifle-*.wav sounds/reload-*.wav
```

### 3. **Progressive Loading Strategy**
```typescript
class ProgressiveLoader {
  // Load critical assets first
  async loadCritical(): Promise<void> {
    await this.load(['player-sprites', 'basic-walls', 'ui-elements']);
  }
  
  // Load level-specific assets
  async loadLevel(levelId: string): Promise<void> {
    const levelAssets = this.getLevelAssets(levelId);
    await this.load(levelAssets);
  }
  
  // Preload next level while playing
  async preloadNextLevel(nextLevelId: string): Promise<void> {
    requestIdleCallback(() => {
      this.loadLevel(nextLevelId);
    });
  }
}
```

## Caching Strategy

### Service Worker for Asset Caching
```javascript
// sw.js
const CACHE_NAME = 'trespasser-assets-v1';
const ASSET_URLS = [
  '/assets/sprites/atlases/players.png',
  '/assets/sprites/atlases/players.json',
  '/assets/sprites/atlases/walls.png',
  '/assets/sprites/atlases/walls.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSET_URLS))
  );
});

self.addEventListener('fetch', event => {
  if (event.request.url.includes('/assets/')) {
    event.respondWith(
      caches.match(event.request)
        .then(response => response || fetch(event.request))
    );
  }
});
```

## Memory Management

### Asset Lifecycle
```typescript
class AssetManager {
  private memoryLimit = 100 * 1024 * 1024; // 100MB
  private assetUsage: Map<string, AssetUsageInfo> = new Map();
  
  trackUsage(key: string): void {
    const info = this.assetUsage.get(key) || {
      lastUsed: Date.now(),
      useCount: 0,
      size: this.getAssetSize(key)
    };
    
    info.lastUsed = Date.now();
    info.useCount++;
    this.assetUsage.set(key, info);
  }
  
  cleanupUnusedAssets(): void {
    const currentMemory = this.getCurrentMemoryUsage();
    
    if (currentMemory > this.memoryLimit) {
      // Sort by least recently used
      const sorted = Array.from(this.assetUsage.entries())
        .sort((a, b) => a[1].lastUsed - b[1].lastUsed);
      
      // Remove until under limit
      for (const [key, info] of sorted) {
        if (this.canRemove(key)) {
          this.assetLoader.unloadAsset(key);
          this.assetUsage.delete(key);
          
          if (this.getCurrentMemoryUsage() < this.memoryLimit * 0.8) {
            break;
          }
        }
      }
    }
  }
}
```

This asset loading strategy provides:
- ✅ Fast initial load with progressive loading
- ✅ Texture atlas optimization
- ✅ Audio sprite efficiency  
- ✅ Memory management
- ✅ Offline caching support
- ✅ Lazy loading for non-critical assets 