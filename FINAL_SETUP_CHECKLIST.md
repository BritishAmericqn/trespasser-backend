# ✅ FINAL SETUP CHECKLIST - Zero Questions Setup!

## 🚀 Complete Project Setup (10 minutes max!)

### Step 1: Initialize Project
```bash
# Option A: If starting fresh
npm create vite@latest trespasser -- --template vanilla-ts
cd trespasser

# Option B: If using existing repo
cd trespasser-backend
rm -rf node_modules package-lock.json  # Clean slate
```

### Step 2: Install Dependencies
```bash
# Install client dependencies
npm install phaser@3.80.1 socket.io-client@4.8.1 msgpack-lite@0.1.26
npm install -D @types/node @types/msgpack-lite typescript@5.3.0 vite@5.0.0 vite-plugin-compression@0.5.1 concurrently@8.2.2 eslint@8.55.0 @typescript-eslint/eslint-plugin@6.15.0 @typescript-eslint/parser@6.15.0 vitest@1.1.0

# Create and setup server
mkdir -p server/src/{systems,rooms}
cd server
npm init -y
npm install socket.io@4.8.1 express@4.18.2 matter-js@0.19.0 msgpack-lite@0.1.26 dotenv@16.3.1 winston@3.11.0
npm install -D nodemon@3.0.2 ts-node@10.9.2 typescript@5.3.0 @types/express@4.17.21 @types/matter-js@0.19.6 @types/msgpack-lite@0.1.11 jest@29.7.0 @types/jest@29.5.11
cd ..
```

### Step 3: Create ALL Required Files
```bash
# Create folder structure
mkdir -p src/{client/{systems,scenes,entities,components},assets/{sprites,audio,maps,ui}}
mkdir -p shared/{types,constants,interfaces}
mkdir -p tests/{client,server,integration}
mkdir -p docs
mkdir -p public
mkdir -p .github/workflows
mkdir -p docker

# Create all config files
touch index.html
touch vite.config.ts
touch tsconfig.json
touch .env
touch .env.example
touch .gitignore
touch server/tsconfig.json
touch server/.env
```

### Step 4: Copy Essential Files

#### .env (Root)
```env
NODE_ENV=development
VITE_SERVER_URL=http://localhost:3000
VITE_SOCKET_PATH=/socket.io
```

#### server/.env
```env
NODE_ENV=development
PORT=3000
CORS_ORIGIN=http://localhost:5173
TICK_RATE=60
NETWORK_RATE=20
MAX_PLAYERS=8
LOG_LEVEL=info
```

#### Update package.json scripts (Root)
```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "server:dev": "cd server && npm run dev",
    "server:build": "cd server && npm run build",
    "server:start": "cd server && npm start",
    "dev:all": "concurrently \"npm run dev\" \"npm run server:dev\"",
    "test": "vitest",
    "lint": "eslint src --ext .ts,.tsx",
    "type-check": "tsc --noEmit"
  }
}
```

#### Update server/package.json scripts
```json
{
  "scripts": {
    "dev": "nodemon --watch 'src/**/*.ts' --exec 'ts-node' src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "jest"
  }
}
```

### Step 5: Create Missing Server System Stubs

#### server/src/systems/PhysicsSystem.ts
```typescript
import Matter from 'matter-js';
import { GAME_CONFIG } from '../../../shared/constants';

export class PhysicsSystem {
  private engine: Matter.Engine;
  private world: Matter.World;
  
  constructor() {
    this.engine = Matter.Engine.create();
    this.world = this.engine.world;
    this.world.gravity.y = 0; // Top-down game
    
    console.log('PhysicsSystem initialized');
  }
  
  update(delta: number): void {
    Matter.Engine.update(this.engine, delta);
  }
  
  addBody(body: Matter.Body): void {
    Matter.World.add(this.world, body);
  }
  
  removeBody(body: Matter.Body): void {
    Matter.World.remove(this.world, body);
  }
  
  destroy(): void {
    Matter.World.clear(this.world, false);
    Matter.Engine.clear(this.engine);
  }
}
```

#### server/src/systems/GameStateSystem.ts
```typescript
import { GameState, PlayerState, InputState } from '../../../shared/types';
import { GAME_CONFIG } from '../../../shared/constants';

export class GameStateSystem {
  private players: Map<string, PlayerState> = new Map();
  private lastUpdateTime: number = Date.now();
  
  constructor() {
    console.log('GameStateSystem initialized');
  }
  
  createPlayer(id: string): PlayerState {
    const player: PlayerState = {
      id,
      transform: {
        position: { x: 240, y: 135 }, // Center of screen
        rotation: 0,
        scale: { x: 1, y: 1 }
      },
      velocity: { x: 0, y: 0 },
      health: GAME_CONFIG.PLAYER_HEALTH,
      armor: 0,
      team: Math.random() > 0.5 ? 'red' : 'blue',
      weaponId: 'rifle',
      isAlive: true,
      movementState: 'idle' as any
    };
    
    this.players.set(id, player);
    return player;
  }
  
  removePlayer(id: string): void {
    this.players.delete(id);
  }
  
  handlePlayerInput(playerId: string, input: InputState): void {
    const player = this.players.get(playerId);
    if (!player || !player.isAlive) return;
    
    // TODO: Process input and update player state
    // This is where movement logic will go
  }
  
  handlePlayerShoot(playerId: string, data: any): void {
    const player = this.players.get(playerId);
    if (!player || !player.isAlive) return;
    
    // TODO: Create projectile
  }
  
  update(delta: number): void {
    // TODO: Update game state
  }
  
  getState(): GameState {
    return {
      players: this.players,
      walls: new Map(),
      projectiles: [],
      timestamp: Date.now(),
      tickRate: GAME_CONFIG.TICK_RATE
    };
  }
}
```

### Step 6: Create Missing Client System Stubs

#### src/client/systems/DestructionSystem.ts
```typescript
import { IGameSystem } from '../../../shared/interfaces/IGameSystem';

export class DestructionSystem implements IGameSystem {
  name = 'DestructionSystem';
  dependencies = ['RenderSystem', 'NetworkSystem'];
  
  private scene: Phaser.Scene;
  
  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }
  
  async initialize(): Promise<void> {
    console.log('DestructionSystem initialized');
    // TODO: Setup wall destruction handling
  }
  
  update(delta: number): void {
    // TODO: Update destruction animations
  }
  
  destroy(): void {
    // TODO: Cleanup
  }
}
```

#### src/client/systems/VisionSystem.ts
```typescript
import { IGameSystem } from '../../../shared/interfaces/IGameSystem';

export class VisionSystem implements IGameSystem {
  name = 'VisionSystem';
  dependencies = ['RenderSystem'];
  
  private scene: Phaser.Scene;
  private fogTexture?: Phaser.GameObjects.RenderTexture;
  
  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }
  
  async initialize(): Promise<void> {
    console.log('VisionSystem initialized');
    // TODO: Create fog of war texture
  }
  
  update(delta: number): void {
    // TODO: Update vision based on player position
  }
  
  destroy(): void {
    this.fogTexture?.destroy();
  }
}
```

#### src/client/systems/AudioSystem.ts
```typescript
import { IGameSystem } from '../../../shared/interfaces/IGameSystem';

export class AudioSystem implements IGameSystem {
  name = 'AudioSystem';
  dependencies = [];
  
  private scene: Phaser.Scene;
  private audioContext?: AudioContext;
  
  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }
  
  async initialize(): Promise<void> {
    this.audioContext = new AudioContext();
    console.log('AudioSystem initialized');
    // TODO: Setup spatial audio
  }
  
  update(delta: number): void {
    // TODO: Update listener position
  }
  
  destroy(): void {
    this.audioContext?.close();
  }
}
```

### Step 7: Copy ALL Files from STARTER_FILES.md
1. Copy `index.html` from ESSENTIAL_FILES.md
2. Copy `vite.config.ts` from ESSENTIAL_FILES.md  
3. Copy `tsconfig.json` files from ESSENTIAL_FILES.md
4. Copy all files from STARTER_FILES.md sections 1-10

### Step 8: First Run!
```bash
# Start everything
npm run dev:all

# You should see:
# - Client running at http://localhost:5173
# - Server running at http://localhost:3000
# - "TRESPASSER" menu screen
# - Console logs showing all systems initialized
```

## ✅ Success Indicators

When setup is complete, you should have:
- [ ] 0 TypeScript errors
- [ ] Game loads to menu screen
- [ ] Console shows "Connected to server!"
- [ ] Clicking PLAY starts the game scene
- [ ] All systems log "initialized" 
- [ ] WASD keys log "Moving up!" (stub behavior)

## 🎯 Next: Start Building Features!

You're now ready to implement features. Use the AI prompts from README.md:

```bash
# Example: Implement movement
"Using the IGameSystem interface, implement full WASD movement in InputSystem.ts 
with three speeds (Ctrl=sneak 50%, normal 100%, Shift=run 150% forward-only). 
Send input state to NetworkSystem using EVENTS.PLAYER_INPUT"
```

## 🚨 Common Issues & Fixes

### "Cannot find module" errors
```bash
# Ensure all dependencies installed
npm install
cd server && npm install && cd ..
```

### "Port already in use"
```bash
# Kill existing processes
lsof -ti:3000 | xargs kill
lsof -ti:5173 | xargs kill
```

### TypeScript errors
```bash
# Ensure TypeScript is installed
npm install -D typescript@5.3.0
```

### Blank screen
- Check browser console for errors
- Ensure index.html is in root directory
- Verify Phaser scenes are registered

## 🎉 You're Ready!

With this setup complete, you have:
- ✅ All files needed to start
- ✅ Working client/server connection
- ✅ System architecture ready
- ✅ Zero configuration questions
- ✅ Ready for AI-assisted development

**Start coding and make developers cry tears of joy!** 🚀 