# 🔧 ESSENTIAL FILES

## 1. index.html (ROOT LEVEL - CRITICAL!)
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Trespasser - Tactical Destruction Shooter</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      background: #000;
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    
    #game-container {
      display: flex;
      justify-content: center;
      align-items: center;
      width: 100vw;
      height: 100vh;
    }
    
    #loading {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      color: white;
      font-size: 24px;
      text-align: center;
    }
    
    .loading-bar {
      width: 300px;
      height: 20px;
      background: #333;
      margin: 20px auto;
      border-radius: 10px;
      overflow: hidden;
    }
    
    .loading-progress {
      height: 100%;
      background: #00ff00;
      width: 0%;
      transition: width 0.3s ease;
    }
    
    .error-message {
      color: #ff0000;
      margin-top: 20px;
      display: none;
    }
  </style>
</head>
<body>
  <div id="game-container">
    <div id="loading">
      <div>Loading Trespasser...</div>
      <div class="loading-bar">
        <div class="loading-progress" id="progress"></div>
      </div>
      <div class="error-message" id="error"></div>
    </div>
  </div>
  <script type="module" src="/src/main.ts"></script>
</body>
</html>
```

## 2. package.json (ROOT)
```json
{
  "name": "trespasser",
  "version": "0.1.0",
  "description": "Top-down destructible multiplayer shooter",
  "type": "module",
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
  },
  "dependencies": {
    "phaser": "^3.80.1",
    "socket.io-client": "^4.8.1",
    "msgpack-lite": "^0.1.26"
  },
  "devDependencies": {
    "@types/node": "^20.10.0",
    "@types/msgpack-lite": "^0.1.11",
    "typescript": "^5.3.0",
    "vite": "^5.0.0",
    "vite-plugin-compression": "^0.5.1",
    "concurrently": "^8.2.2",
    "eslint": "^8.55.0",
    "@typescript-eslint/eslint-plugin": "^6.15.0",
    "@typescript-eslint/parser": "^6.15.0",
    "vitest": "^1.1.0"
  }
}
```

## 3. server/package.json
```json
{
  "name": "trespasser-server",
  "version": "0.1.0",
  "description": "Game server for Trespasser",
  "type": "module",
  "scripts": {
    "dev": "nodemon --watch 'src/**/*.ts' --exec 'node --loader ts-node/esm' src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "jest"
  },
  "dependencies": {
    "socket.io": "^4.8.1",
    "express": "^4.18.2",
    "matter-js": "^0.19.0",
    "msgpack-lite": "^0.1.26",
    "dotenv": "^16.3.1",
    "winston": "^3.11.0"
  },
  "devDependencies": {
    "nodemon": "^3.0.2",
    "ts-node": "^10.9.2",
    "typescript": "^5.3.0",
    "@types/express": "^4.17.21",
    "@types/matter-js": "^0.19.6",
    "@types/msgpack-lite": "^0.1.11",
    "jest": "^29.7.0",
    "@types/jest": "^29.5.11"
  }
}
```

## 4. tsconfig.json (ROOT)
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "allowSyntheticDefaultImports": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@shared/*": ["./shared/*"],
      "@client/*": ["./src/client/*"],
      "@assets/*": ["./src/assets/*"]
    }
  },
  "include": ["src/**/*", "shared/**/*"],
  "exclude": ["node_modules", "dist", "server"]
}
```

## 5. server/tsconfig.json
```json
{
  "extends": "../tsconfig.json",
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",
    "rootDir": "./src",
    "baseUrl": ".",
    "paths": {
      "@shared/*": ["../shared/*"],
      "@/*": ["./src/*"]
    }
  },
  "include": ["src/**/*", "../shared/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

## 6. vite.config.ts
```typescript
import { defineConfig } from 'vite';
import { resolve } from 'path';
import compression from 'vite-plugin-compression';

export default defineConfig({
  plugins: [
    compression({
      algorithm: 'gzip',
      ext: '.gz'
    }),
    compression({
      algorithm: 'brotliCompress',
      ext: '.br'
    })
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@shared': resolve(__dirname, './shared'),
      '@client': resolve(__dirname, './src/client'),
      '@assets': resolve(__dirname, './src/assets')
    }
  },
  server: {
    port: 5173,
    proxy: {
      '/socket.io': {
        target: 'http://localhost:3000',
        ws: true,
        changeOrigin: true
      }
    }
  },
  build: {
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          phaser: ['phaser'],
          vendor: ['socket.io-client', 'msgpack-lite']
        }
      }
    }
  },
  optimizeDeps: {
    include: ['phaser', 'socket.io-client', 'msgpack-lite']
  }
});
```

## 7. shared/types/index.ts
```typescript
// Core shared types
export interface Vector2 {
  x: number;
  y: number;
}

export interface Transform {
  position: Vector2;
  rotation: number;
  scale: Vector2;
}

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Player types
export interface PlayerState {
  id: string;
  transform: Transform;
  velocity: Vector2;
  health: number;
  armor: number;
  team: 'red' | 'blue';
  weaponId: string;
  isAlive: boolean;
  movementState: MovementState;
}

export enum MovementState {
  IDLE = 'idle',
  WALKING = 'walking',
  RUNNING = 'running',
  SNEAKING = 'sneaking'
}

// Wall types
export interface WallState {
  id: string;
  position: Vector2;
  width: number;
  height: number;
  destructionMask: Uint8Array;
  bulletHoles: BulletHole[];
  material: WallMaterial;
}

export interface BulletHole {
  x: number;
  y: number;
  angle: number;
  size: number;
}

export enum WallMaterial {
  CONCRETE = 'concrete',
  WOOD = 'wood',
  METAL = 'metal',
  GLASS = 'glass'
}

// Projectile types
export interface ProjectileState {
  id: string;
  position: Vector2;
  velocity: Vector2;
  type: ProjectileType;
  ownerId: string;
  damage: number;
  timestamp: number;
}

export enum ProjectileType {
  BULLET = 'bullet',
  ROCKET = 'rocket',
  GRENADE = 'grenade'
}

// Game state
export interface GameState {
  players: Map<string, PlayerState>;
  walls: Map<string, WallState>;
  projectiles: ProjectileState[];
  timestamp: number;
  tickRate: number;
}

// Input types
export interface InputState {
  keys: {
    w: boolean;
    a: boolean;
    s: boolean;
    d: boolean;
    shift: boolean;
    ctrl: boolean;
  };
  mouse: {
    x: number;
    y: number;
    buttons: number;
  };
  sequence: number;
  timestamp: number;
}
```

## 8. shared/types/network.ts
```typescript
import { PlayerState, WallState, ProjectileState, InputState, GameState } from './index';

// Base message structure
interface BaseMessage {
  timestamp: number;
  sequence?: number;
}

// Client to Server messages
export interface ClientMessage extends BaseMessage {
  type: 'input' | 'ping' | 'chat' | 'joinTeam';
}

export interface InputMessage extends ClientMessage {
  type: 'input';
  payload: InputState;
}

export interface PingMessage extends ClientMessage {
  type: 'ping';
}

export interface ChatMessage extends ClientMessage {
  type: 'chat';
  payload: {
    message: string;
    team?: boolean;
  };
}

export interface JoinTeamMessage extends ClientMessage {
  type: 'joinTeam';
  payload: {
    team: 'red' | 'blue';
  };
}

// Server to Client messages
export interface ServerMessage extends BaseMessage {
  type: 'gameState' | 'playerJoin' | 'playerLeave' | 'wallDamage' | 
        'projectileFired' | 'chat' | 'error' | 'pong';
}

export interface GameStateMessage extends ServerMessage {
  type: 'gameState';
  payload: GameState;
  lastProcessedInput: number;
}

export interface PlayerJoinMessage extends ServerMessage {
  type: 'playerJoin';
  payload: PlayerState;
}

export interface PlayerLeaveMessage extends ServerMessage {
  type: 'playerLeave';
  payload: {
    playerId: string;
  };
}

export interface WallDamageMessage extends ServerMessage {
  type: 'wallDamage';
  payload: {
    wallId: string;
    damage: WallDamageEvent;
  };
}

export interface WallDamageEvent {
  position: { x: number; y: number };
  damage: number;
  type: 'bullet' | 'explosive';
  radius?: number;
}

export interface ProjectileFiredMessage extends ServerMessage {
  type: 'projectileFired';
  payload: ProjectileState;
}

export interface ServerChatMessage extends ServerMessage {
  type: 'chat';
  payload: {
    playerId: string;
    playerName: string;
    message: string;
    team?: boolean;
  };
}

export interface ErrorMessage extends ServerMessage {
  type: 'error';
  payload: {
    code: string;
    message: string;
    fatal?: boolean;
  };
}

export interface PongMessage extends ServerMessage {
  type: 'pong';
  payload: {
    clientTime: number;
    serverTime: number;
  };
}

// Type guards
export function isClientMessage(msg: any): msg is ClientMessage {
  return msg && typeof msg.type === 'string' && typeof msg.timestamp === 'number';
}

export function isServerMessage(msg: any): msg is ServerMessage {
  return msg && typeof msg.type === 'string' && typeof msg.timestamp === 'number';
}

// Union types for easy handling
export type NetworkMessage = ClientMessage | ServerMessage;
export type ClientToServer = InputMessage | PingMessage | ChatMessage | JoinTeamMessage;
export type ServerToClient = GameStateMessage | PlayerJoinMessage | PlayerLeaveMessage | 
                            WallDamageMessage | ProjectileFiredMessage | ServerChatMessage | 
                            ErrorMessage | PongMessage;
```

## 9. .gitignore
```
# Dependencies
node_modules/
.pnp
.pnp.js

# Production
dist/
build/

# Development
.env.local
.env.development.local
.env.test.local
.env.production.local

# Logs
logs/
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
lerna-debug.log*

# OS
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# Testing
coverage/
.nyc_output/

# Misc
.cache/
.parcel-cache/
.next/
.nuxt/
.vuepress/dist/
.serverless/
.fusebox/
.dynamodb/
.tern-port

# Server specific
server/dist/
server/logs/

# Environment
.env
```

## 10. .env.example
```bash
# Server Configuration
NODE_ENV=development
PORT=3000
SERVER_URL=http://localhost:3000

# Client Configuration
VITE_SERVER_URL=http://localhost:3000
VITE_SOCKET_PATH=/socket.io

# Game Configuration
TICK_RATE=60
MAX_PLAYERS=8
ROOM_SIZE=4

# Security
JWT_SECRET=your-secret-key-here
CORS_ORIGIN=http://localhost:5173

# Monitoring
ENABLE_METRICS=true
LOG_LEVEL=info

# Database (if needed later)
# DB_HOST=localhost
# DB_PORT=5432
# DB_NAME=trespasser
```

These files provide the complete foundation your project needs! 