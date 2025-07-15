# 📁 COMPLETE PROJECT STRUCTURE

## Root Directory Layout
```
trespasser/
├── .github/                    # GitHub Actions CI/CD
│   └── workflows/
│       ├── ci.yml             # Continuous Integration
│       └── deploy.yml         # Deployment workflow
├── src/                       # CLIENT CODE ONLY
│   ├── assets/               # Asset organization
│   │   ├── sprites/
│   │   │   ├── player/
│   │   │   ├── walls/
│   │   │   └── weapons/
│   │   ├── audio/
│   │   │   ├── sfx/
│   │   │   └── ambient/
│   │   ├── maps/
│   │   └── ui/
│   ├── client/              # Client systems
│   │   ├── systems/
│   │   ├── entities/
│   │   ├── components/
│   │   └── scenes/
│   └── main.ts              # Client entry point
├── server/                   # SERVER CODE (separate folder)
│   ├── src/
│   │   ├── systems/
│   │   ├── entities/
│   │   ├── rooms/
│   │   └── index.ts        # Server entry point
│   ├── dist/               # Compiled server code
│   ├── package.json        # Server dependencies
│   └── tsconfig.json       # Server TypeScript config
├── shared/                  # SHARED CODE
│   ├── constants/
│   │   └── index.ts        # Game constants
│   ├── types/
│   │   ├── index.ts        # Core types
│   │   ├── network.ts      # Network messages
│   │   └── game.ts         # Game state types
│   └── utils/
│       └── math.ts         # Shared utilities
├── public/                  # Static files
│   └── (empty - Vite serves from src)
├── tests/                   # Test files
│   ├── client/
│   ├── server/
│   └── integration/
├── docker/                  # Container configs
│   ├── Dockerfile.client
│   └── Dockerfile.server
├── docs/                    # Documentation
│   ├── API.md
│   └── ARCHITECTURE.md
├── .env.example            # Environment template
├── .gitignore             # Git ignore rules
├── index.html             # Main HTML file
├── package.json           # Root dependencies
├── tsconfig.json          # Root TS config
├── vite.config.ts         # Vite configuration
└── README.md              # Project documentation
```

## Why This Structure?

### 1. **Separate Client/Server Folders**
- **Clean deployment**: Deploy only what's needed
- **Clear boundaries**: No accidental imports
- **Independent builds**: Different compilation targets

### 2. **Shared Folder at Root**
- **Type safety**: Share types between client/server
- **Constants**: Game rules in one place
- **No duplication**: Single source of truth

### 3. **Assets in src/**
- **Vite optimization**: Automatic asset handling
- **Import support**: `import playerSprite from './assets/sprites/player.png'`
- **Hot reload**: Changes reflected immediately

### 4. **Proper Config Files**
- **Root configs**: Shared settings
- **Server configs**: Node-specific settings
- **Type roots**: Proper module resolution

## File Organization Examples

### Client System
```typescript
// src/client/systems/DestructionSystem.ts
import { IGameSystem } from '@/client/interfaces/IGameSystem';
import { WallState } from '@shared/types/game';
import { WALL_HEALTH } from '@shared/constants';
```

### Server System
```typescript
// server/src/systems/PhysicsSystem.ts
import { PlayerState, WallState } from '../../../shared/types/game';
import { PHYSICS_STEP } from '../../../shared/constants';
```

### Shared Types
```typescript
// shared/types/game.ts
export interface GameState {
  players: Map<string, PlayerState>;
  walls: Map<string, WallState>;
  timestamp: number;
}
```

## Build Outputs

### Development
- Client: Served by Vite dev server (port 5173)
- Server: Running via ts-node (port 3000)

### Production
- Client: `dist/` (static files for CDN)
- Server: `server/dist/` (Node.js app)

## Import Aliases

### Client (vite.config.ts)
```typescript
alias: {
  '@': '/src',
  '@shared': '/shared',
  '@client': '/src/client',
  '@assets': '/src/assets'
}
```

### Server (tsconfig.json paths)
```json
"paths": {
  "@shared/*": ["../shared/*"],
  "@/*": ["./src/*"]
}
```

## Asset Loading Strategy

### Sprites Organization
```
src/assets/sprites/
├── player/
│   ├── idle.png
│   ├── walk-1.png
│   ├── walk-2.png
│   └── atlas.json    # Texture atlas
├── walls/
│   ├── concrete/
│   │   ├── intact.png
│   │   ├── damaged.png
│   │   └── critical.png
│   └── atlas.json
└── weapons/
    ├── rifle.png
    └── bullet.png
```

### Audio Organization
```
src/assets/audio/
├── sfx/
│   ├── weapons/
│   │   ├── rifle-fire.ogg
│   │   └── rifle-reload.ogg
│   ├── impacts/
│   │   ├── bullet-concrete.ogg
│   │   └── explosion.ogg
│   └── movement/
│       ├── footstep-1.ogg
│       └── footstep-2.ogg
└── ambient/
    ├── room-tone.ogg
    └── distant-gunfire.ogg
```

## Docker Structure
```
docker/
├── Dockerfile.client
├── Dockerfile.server
├── docker-compose.yml
└── nginx.conf         # For production
```

This structure ensures:
- ✅ Clean separation of concerns
- ✅ Easy deployment
- ✅ Type safety across the stack
- ✅ Optimal asset handling
- ✅ Scalable organization 