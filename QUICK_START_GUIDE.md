# 🚀 QUICK START GUIDE

## 1. Initial Setup (15 minutes)

```bash
# Create project
npm create vite@latest trespasser -- --template vanilla-ts
cd trespasser

# Install all dependencies
npm install phaser@3.80.1 socket.io-client@4.8.1 msgpack-lite@0.1.26
npm install -D @types/node vite-plugin-compression

# Setup server
mkdir server && cd server
npm init -y
npm install socket.io express matter-js msgpack-lite dotenv
npm install -D nodemon ts-node typescript @types/express @types/matter-js

# Create folder structure
cd ..
mkdir -p src/{client,server,shared}/{systems,entities,components,types}
```

## 2. Copy-Paste Starter Files

### `src/client/main.ts`
```typescript
import { RenderSystem } from './systems/RenderSystem';
import { NetworkSystem } from './systems/NetworkSystem';
import { InputSystem } from './systems/InputSystem';

// Initialize systems
const renderSystem = new RenderSystem();
const networkSystem = new NetworkSystem();
const inputSystem = new InputSystem();

async function init() {
  await renderSystem.initialize();
  await networkSystem.initialize();
  await inputSystem.initialize();
  
  console.log('Game initialized!');
}

init();
```

### `src/server/index.ts`
```typescript
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { PhysicsSystem } from './systems/PhysicsSystem';
import { GameStateSystem } from './systems/GameStateSystem';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*" }
});

const physics = new PhysicsSystem();
const gameState = new GameStateSystem();

io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);
  gameState.addPlayer(socket.id);
  
  socket.on('input', (data) => {
    gameState.handleInput(socket.id, data);
  });
  
  socket.on('disconnect', () => {
    gameState.removePlayer(socket.id);
  });
});

// Game loop
setInterval(() => {
  physics.update();
  const state = gameState.getState();
  io.emit('gameState', state);
}, 1000 / 60);

httpServer.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

### `src/shared/types/index.ts`
```typescript
export interface Vector2 {
  x: number;
  y: number;
}

export interface PlayerState {
  id: string;
  position: Vector2;
  rotation: number;
  health: number;
}

export interface WallState {
  id: string;
  position: Vector2;
  width: number;
  height: number;
  destructionMask: number[];
}

export interface GameState {
  players: Map<string, PlayerState>;
  walls: Map<string, WallState>;
  projectiles: ProjectileState[];
  timestamp: number;
}
```

## 3. Run the Game

```bash
# Terminal 1 - Start server
cd server
npm run dev

# Terminal 2 - Start client
npm run dev
```

## 4. Test Basic Functionality

1. Open browser to `http://localhost:5173`
2. You should see a black screen (Phaser canvas)
3. Check console for "Game initialized!"
4. Check server console for connection logs

## 5. Next Steps

### Day 1: Movement & Rendering
- [ ] Add player sprite
- [ ] Implement WASD movement
- [ ] Add basic tilemap

### Day 2: Networking
- [ ] Send player position to server
- [ ] Receive other players' positions
- [ ] Basic interpolation

### Day 3: Destruction
- [ ] Add wall entities
- [ ] Implement bullet shooting
- [ ] Basic wall damage

### Day 4: Vision System
- [ ] Add fog of war overlay
- [ ] Implement raycasting
- [ ] Vision through holes

## 6. AI Prompts for Each Feature

### Movement System
```
"Create a movement system for src/client/systems/InputSystem.ts that:
- Captures WASD input
- Sends input to network system
- Has 3 speed modes (shift=run, ctrl=walk, normal)
- Uses Phaser's keyboard API
- Follows the IGameSystem interface"
```

### Destruction System
```
"Create a destruction system that:
- Tracks wall health in 5 vertical slices
- Updates wall sprite with damage states
- Syncs destruction with server
- Creates light leaks through holes
- Uses Phaser's RenderTexture for masks"
```

### Vision System
```
"Create a fog of war system that:
- Uses RenderTexture overlay
- Casts rays from player position
- Reveals areas through destroyed walls
- Shows small light through bullet holes
- Large light slabs through destroyed sections"
```

## 🎯 Remember: Each system should be testable in isolation! 