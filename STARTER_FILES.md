# 🚀 STARTER FILES - Copy & Paste to Begin!

These are the essential files missing from other documentation. Copy these to start coding immediately!

## 1. src/main.ts (Client Entry Point)
```typescript
import Phaser from 'phaser';
import { LoadingScene } from './client/scenes/LoadingScene';
import { MenuScene } from './client/scenes/MenuScene';
import { GameScene } from './client/scenes/GameScene';
import { GAME_CONFIG } from '../shared/constants';

// Game configuration
const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: GAME_CONFIG.GAME_WIDTH,
  height: GAME_CONFIG.GAME_HEIGHT,
  parent: 'game-container',
  backgroundColor: '#000000',
  pixelArt: true,
  antialias: false,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_CONFIG.GAME_WIDTH,
    height: GAME_CONFIG.GAME_HEIGHT
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 0 },
      debug: process.env.NODE_ENV === 'development'
    }
  },
  scene: [LoadingScene, MenuScene, GameScene]
};

// Hide loading div and start game
window.addEventListener('load', () => {
  const loadingElement = document.getElementById('loading');
  if (loadingElement) {
    loadingElement.style.display = 'none';
  }
  
  new Phaser.Game(config);
});
```

## 2. shared/interfaces/IGameSystem.ts
```typescript
export interface IGameSystem {
  name: string;
  dependencies: string[];
  
  initialize(): Promise<void>;
  update(delta: number): void;
  destroy(): void;
}

export interface INetworkedSystem extends IGameSystem {
  onServerUpdate(data: any): void;
  getNetworkState(): any;
}
```

## 3. shared/constants/index.ts
```typescript
export const GAME_CONFIG = {
  // Display
  GAME_WIDTH: 480,
  GAME_HEIGHT: 270,
  SCALE_FACTOR: 4,
  
  // Networking
  SERVER_URL: process.env.VITE_SERVER_URL || 'http://localhost:3000',
  TICK_RATE: 60,
  NETWORK_RATE: 20,
  
  // Player
  PLAYER_SPEED_SNEAK: 50,
  PLAYER_SPEED_WALK: 100,
  PLAYER_SPEED_RUN: 150,
  PLAYER_SIZE: 12,
  PLAYER_HEALTH: 100,
  
  // Walls
  WALL_TILE_SIZE: 15,
  WALL_SLICE_WIDTH: 3,
  WALL_SLICES_PER_TILE: 5,
  WALL_HEALTH_PER_SLICE: 100,
  
  // Vision
  VISION_RANGE: 100,
  VISION_ANGLE: 90,
  VISION_RAYS: 45,
  HOLE_VISION_ANGLE: 15,
  
  // Weapons
  WEAPON_BULLET_SPEED: 500,
  WEAPON_BULLET_DAMAGE: 25,
  WEAPON_ROCKET_SPEED: 300,
  WEAPON_ROCKET_DAMAGE: 150,
  WEAPON_ROCKET_RADIUS: 30,
  
  // Audio
  AUDIO_FALLOFF_DISTANCE: 200,
  AUDIO_WALL_MUFFLE_FACTOR: 0.5,
  
  // Physics
  PHYSICS_STEP: 1000 / 60
} as const;

export const EVENTS = {
  // Client to Server
  PLAYER_INPUT: 'player:input',
  PLAYER_SHOOT: 'player:shoot',
  PLAYER_RELOAD: 'player:reload',
  
  // Server to Client
  GAME_STATE: 'game:state',
  PLAYER_JOINED: 'player:joined',
  PLAYER_LEFT: 'player:left',
  WALL_DAMAGED: 'wall:damaged',
  PROJECTILE_FIRED: 'projectile:fired',
  PROJECTILE_HIT: 'projectile:hit',
  
  // Audio Events
  SOUND_PLAY: 'sound:play',
  SOUND_STOP: 'sound:stop'
} as const;
```

## 4. src/client/scenes/LoadingScene.ts
```typescript
import Phaser from 'phaser';

export class LoadingScene extends Phaser.Scene {
  private progressBar!: Phaser.GameObjects.Graphics;
  private progressBox!: Phaser.GameObjects.Graphics;
  private loadingText!: Phaser.GameObjects.Text;
  private percentText!: Phaser.GameObjects.Text;
  
  constructor() {
    super({ key: 'LoadingScene' });
  }
  
  preload(): void {
    this.createLoadingUI();
    this.loadAssets();
  }
  
  private createLoadingUI(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    
    // Progress bar background
    this.progressBox = this.add.graphics();
    this.progressBox.fillStyle(0x222222, 0.8);
    this.progressBox.fillRect(width / 2 - 160, height / 2 - 25, 320, 50);
    
    // Progress bar
    this.progressBar = this.add.graphics();
    
    // Loading text
    this.loadingText = this.add.text(width / 2, height / 2 - 50, 'Loading...', {
      font: '20px monospace',
      color: '#ffffff'
    }).setOrigin(0.5, 0.5);
    
    // Percent text
    this.percentText = this.add.text(width / 2, height / 2, '0%', {
      font: '18px monospace',
      color: '#ffffff'
    }).setOrigin(0.5, 0.5);
    
    // Update progress bar
    this.load.on('progress', (value: number) => {
      this.percentText.setText(Math.floor(value * 100) + '%');
      this.progressBar.clear();
      this.progressBar.fillStyle(0xffffff, 1);
      this.progressBar.fillRect(width / 2 - 150, height / 2 - 15, 300 * value, 30);
    });
    
    // Complete
    this.load.on('complete', () => {
      this.progressBar.destroy();
      this.progressBox.destroy();
      this.loadingText.destroy();
      this.percentText.destroy();
      this.scene.start('MenuScene');
    });
  }
  
  private loadAssets(): void {
    // TODO: Load actual assets
    // For now, create placeholder assets
    this.load.image('player', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==');
    this.load.image('wall', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==');
    this.load.image('bullet', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==');
  }
}
```

## 5. src/client/scenes/MenuScene.ts
```typescript
import Phaser from 'phaser';
import { GAME_CONFIG } from '../../../shared/constants';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MenuScene' });
  }
  
  create(): void {
    const { width, height } = this.cameras.main;
    
    // Title
    this.add.text(width / 2, height / 2 - 50, 'TRESPASSER', {
      fontSize: '48px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    
    // Play button
    const playButton = this.add.text(width / 2, height / 2 + 20, 'PLAY', {
      fontSize: '24px',
      color: '#00ff00',
      backgroundColor: '#000000',
      padding: { x: 20, y: 10 }
    }).setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => playButton.setColor('#ffffff'))
      .on('pointerout', () => playButton.setColor('#00ff00'))
      .on('pointerdown', () => this.startGame());
    
    // Instructions
    this.add.text(width / 2, height - 30, 'WASD: Move | Mouse: Aim | Click: Shoot', {
      fontSize: '12px',
      color: '#888888'
    }).setOrigin(0.5);
  }
  
  private startGame(): void {
    this.scene.start('GameScene');
  }
}
```

## 6. src/client/scenes/GameScene.ts
```typescript
import Phaser from 'phaser';
import { GameSystemManager } from '../systems/GameSystemManager';
import { RenderSystem } from '../systems/RenderSystem';
import { InputSystem } from '../systems/InputSystem';
import { NetworkSystem } from '../systems/NetworkSystem';
import { DestructionSystem } from '../systems/DestructionSystem';
import { VisionSystem } from '../systems/VisionSystem';
import { AudioSystem } from '../systems/AudioSystem';

export class GameScene extends Phaser.Scene {
  private systemManager!: GameSystemManager;
  
  constructor() {
    super({ key: 'GameScene' });
  }
  
  async create(): Promise<void> {
    // Initialize system manager
    this.systemManager = new GameSystemManager(this);
    
    // Register all systems
    this.systemManager.registerSystem(new RenderSystem(this));
    this.systemManager.registerSystem(new InputSystem(this));
    this.systemManager.registerSystem(new NetworkSystem(this));
    this.systemManager.registerSystem(new DestructionSystem(this));
    this.systemManager.registerSystem(new VisionSystem(this));
    this.systemManager.registerSystem(new AudioSystem(this));
    
    // Initialize all systems
    await this.systemManager.initialize();
    
    console.log('Game scene initialized!');
  }
  
  update(time: number, delta: number): void {
    this.systemManager.update(delta);
  }
  
  shutdown(): void {
    this.systemManager.destroy();
  }
}
```

## 7. src/client/systems/GameSystemManager.ts
```typescript
import { IGameSystem } from '../../../shared/interfaces/IGameSystem';

export class GameSystemManager {
  private systems: Map<string, IGameSystem> = new Map();
  private scene: Phaser.Scene;
  
  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }
  
  registerSystem(system: IGameSystem): void {
    this.systems.set(system.name, system);
  }
  
  getSystem<T extends IGameSystem>(name: string): T {
    const system = this.systems.get(name);
    if (!system) {
      throw new Error(`System ${name} not found`);
    }
    return system as T;
  }
  
  async initialize(): Promise<void> {
    // Initialize systems in dependency order
    const initialized = new Set<string>();
    const initializeSystem = async (system: IGameSystem) => {
      if (initialized.has(system.name)) return;
      
      // Initialize dependencies first
      for (const dep of system.dependencies) {
        const depSystem = this.systems.get(dep);
        if (depSystem) {
          await initializeSystem(depSystem);
        }
      }
      
      // Initialize this system
      await system.initialize();
      initialized.add(system.name);
      console.log(`Initialized system: ${system.name}`);
    };
    
    for (const system of this.systems.values()) {
      await initializeSystem(system);
    }
  }
  
  update(delta: number): void {
    for (const system of this.systems.values()) {
      system.update(delta);
    }
  }
  
  destroy(): void {
    for (const system of this.systems.values()) {
      system.destroy();
    }
    this.systems.clear();
  }
}
```

## 8. server/src/index.ts
```typescript
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import { GameRoom } from './rooms/GameRoom';
import { EVENTS, GAME_CONFIG } from '../../shared/constants';

// Load environment variables
dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    methods: ['GET', 'POST']
  }
});

// Game rooms
const rooms = new Map<string, GameRoom>();

// Create default room
const defaultRoom = new GameRoom('default', io);
rooms.set('default', defaultRoom);

// Handle connections
io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);
  
  // Join default room for now
  defaultRoom.addPlayer(socket);
  
  socket.on('disconnect', () => {
    console.log('Player disconnected:', socket.id);
    defaultRoom.removePlayer(socket.id);
  });
});

// Start server
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🎮 Game tick rate: ${GAME_CONFIG.TICK_RATE} Hz`);
  console.log(`🌐 Network rate: ${GAME_CONFIG.NETWORK_RATE} Hz`);
});
```

## 9. server/src/rooms/GameRoom.ts
```typescript
import { Socket, Server } from 'socket.io';
import { GameState, PlayerState } from '../../../shared/types';
import { PhysicsSystem } from '../systems/PhysicsSystem';
import { GameStateSystem } from '../systems/GameStateSystem';
import { EVENTS, GAME_CONFIG } from '../../../shared/constants';

export class GameRoom {
  private id: string;
  private io: Server;
  private players: Map<string, Socket> = new Map();
  private physics: PhysicsSystem;
  private gameState: GameStateSystem;
  private gameLoopInterval?: NodeJS.Timeout;
  private networkInterval?: NodeJS.Timeout;
  
  constructor(id: string, io: Server) {
    this.id = id;
    this.io = io;
    this.physics = new PhysicsSystem();
    this.gameState = new GameStateSystem();
    this.startGameLoop();
  }
  
  addPlayer(socket: Socket): void {
    this.players.set(socket.id, socket);
    
    // Create player state
    const playerState = this.gameState.createPlayer(socket.id);
    
    // Send initial state to player
    socket.emit(EVENTS.GAME_STATE, this.gameState.getState());
    
    // Notify others
    socket.broadcast.emit(EVENTS.PLAYER_JOINED, playerState);
    
    // Setup event handlers
    socket.on(EVENTS.PLAYER_INPUT, (input) => {
      this.gameState.handlePlayerInput(socket.id, input);
    });
    
    socket.on(EVENTS.PLAYER_SHOOT, (data) => {
      this.gameState.handlePlayerShoot(socket.id, data);
    });
  }
  
  removePlayer(playerId: string): void {
    this.players.delete(playerId);
    this.gameState.removePlayer(playerId);
    this.io.emit(EVENTS.PLAYER_LEFT, { playerId });
  }
  
  private startGameLoop(): void {
    // Physics/game update loop
    this.gameLoopInterval = setInterval(() => {
      this.physics.update(1000 / GAME_CONFIG.TICK_RATE);
      this.gameState.update(1000 / GAME_CONFIG.TICK_RATE);
    }, 1000 / GAME_CONFIG.TICK_RATE);
    
    // Network update loop
    this.networkInterval = setInterval(() => {
      const state = this.gameState.getState();
      this.io.to(this.id).emit(EVENTS.GAME_STATE, state);
    }, 1000 / GAME_CONFIG.NETWORK_RATE);
  }
  
  destroy(): void {
    if (this.gameLoopInterval) clearInterval(this.gameLoopInterval);
    if (this.networkInterval) clearInterval(this.networkInterval);
  }
}
```

## 10. Basic System Stubs

### src/client/systems/RenderSystem.ts
```typescript
import { IGameSystem } from '../../../shared/interfaces/IGameSystem';

export class RenderSystem implements IGameSystem {
  name = 'RenderSystem';
  dependencies = [];
  
  private scene: Phaser.Scene;
  
  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }
  
  async initialize(): Promise<void> {
    console.log('RenderSystem initialized');
    // TODO: Setup rendering
  }
  
  update(delta: number): void {
    // TODO: Update rendering
  }
  
  destroy(): void {
    // TODO: Cleanup
  }
}
```

### src/client/systems/InputSystem.ts
```typescript
import { IGameSystem } from '../../../shared/interfaces/IGameSystem';

export class InputSystem implements IGameSystem {
  name = 'InputSystem';
  dependencies = [];
  
  private scene: Phaser.Scene;
  private keys?: Phaser.Types.Input.Keyboard.CursorKeys;
  
  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }
  
  async initialize(): Promise<void> {
    this.keys = this.scene.input.keyboard?.createCursorKeys();
    console.log('InputSystem initialized');
  }
  
  update(delta: number): void {
    if (!this.keys) return;
    
    // TODO: Handle input
    if (this.keys.up.isDown) {
      console.log('Moving up!');
    }
  }
  
  destroy(): void {
    // TODO: Cleanup
  }
}
```

### src/client/systems/NetworkSystem.ts
```typescript
import { io, Socket } from 'socket.io-client';
import { IGameSystem } from '../../../shared/interfaces/IGameSystem';
import { GAME_CONFIG } from '../../../shared/constants';

export class NetworkSystem implements IGameSystem {
  name = 'NetworkSystem';
  dependencies = [];
  
  private socket?: Socket;
  
  async initialize(): Promise<void> {
    this.socket = io(GAME_CONFIG.SERVER_URL);
    
    this.socket.on('connect', () => {
      console.log('Connected to server!');
    });
    
    this.socket.on('disconnect', () => {
      console.log('Disconnected from server');
    });
  }
  
  update(delta: number): void {
    // Network updates handled by events
  }
  
  destroy(): void {
    this.socket?.disconnect();
  }
}
```

## Next Steps

1. Copy all these files to your project
2. Run `npm install` and `cd server && npm install`
3. Run `npm run dev:all`
4. You should see the game running!
5. Start implementing features using the AI prompts in README.md

Each system stub is ready for AI-assisted implementation. Just provide the interface and requirements! 