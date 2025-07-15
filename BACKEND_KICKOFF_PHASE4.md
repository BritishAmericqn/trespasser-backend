# 🎮 BACKEND KICKOFF PROMPT: Phase 4 - Core Gameplay Systems

## 📋 Context

You are implementing critical gameplay systems for "Trespasser", a multiplayer 2D top-down pixel art shooter. The game runs at 480x270 resolution with 2-8 players (1v1 to 4v4). You've already completed:
- ✅ Multiplayer movement with 3 speeds (sneak/walk/run)
- ✅ Weapon system with projectiles and wall destruction  
- ✅ Physics system (Matter.js) for grenades
- ✅ Network broadcasting at 60Hz physics / 20Hz network

Current issues:
- ⚠️ Players can walk through walls (no physics collision)
- ❌ No fog of war/vision system implemented
- ❌ Other players not visible in game

## 🎯 Your Role

You are an expert game backend engineer specializing in real-time multiplayer systems. You excel at building performant, cheat-resistant game servers with clean architecture. Your code is production-ready and follows best practices.

## 🎮 Objective

Implement three interconnected systems that form the core gameplay experience:
1. **Player-Wall Collision System** - Prevent players from walking through walls
2. **Fog of War Vision System** - Server-side visibility calculations  
3. **Player Visibility System** - Only send visible player data to clients

## 📐 Technical Specifications

### Game Constants
- Game area: 480x270 pixels
- Tick rate: 60Hz physics, 20Hz network broadcasts  
- Wall system: Already has Matter.js bodies (static, friction=0.8, restitution=0.5)
- Player size: Approximately 10x10 pixels
- Max players: 8

### Current Architecture
- PhysicsSystem: Matter.js engine with wall bodies already created
- GameStateSystem: Handles player movement and state
- ProjectileSystem: Uses collision detection for projectiles
- Server runs on Node.js with TypeScript

## 🛠️ Implementation Requirements

### 1. Player-Wall Collision System

#### Task
Integrate player movement with the existing Matter.js physics bodies to prevent wall phasing.

#### Approach
- Create Matter.js bodies for players (similar to projectiles)
- Use Matter.js collision detection for player-wall interactions
- Ensure smooth movement without getting stuck on corners
- Handle edge cases: diagonal movement, high-speed collisions

#### Pitfalls to Avoid
- Don't let physics engine take full control (causes floaty movement)
- Prevent players getting stuck in walls during spawn/teleport
- Avoid jittery movement from conflicting position updates
- Handle network desync when collision prevents movement

### 2. Fog of War Vision System  

#### Task
Implement server-side line-of-sight calculations to determine what each player can see.

#### Approach
- Use scanline algorithm on 480x270 pixel grid (fast at this resolution)
- Calculate vision from player position with ~120° field of view
- Walls block vision, destroyed walls create sight lines
- Cache vision results, only recalculate on position/wall changes
- Consider mouse position for extended vision direction (8 directional)

#### Pitfalls to Avoid
- Don't recalculate vision every frame (only on significant movement)
- Never trust client vision data (server authoritative)
- Avoid sending non-visible entity data to prevent wallhacks
- Cache static vision data, only update dynamic elements

### 3. Player Visibility Broadcasting

#### Task
Only send player position/state data for players that are visible to each client.

#### Approach
- Filter game state per player based on vision calculations
- Include recently visible players with "last seen" position (1-2 seconds)
- Send full data for visible players, minimal data for audible-only
- Implement smooth appear/disappear transitions

#### Network Optimization
- Only send deltas when visibility state changes
- Batch visibility updates with position updates
- Use bit flags for visibility states
- Implement interest management based on distance + vision

## 📦 Deliverables

1. **GameStateSystem.ts** - Updated with collision checks before movement
2. **VisionSystem.ts** - New system for FOV calculations  
3. **PhysicsSystem.ts** - Player body management
4. **GameRoom.ts** - Filtered state broadcasting per player
5. **Integration tests** - Collision, vision, and visibility scenarios

## ✅ Success Criteria

- Players cannot pass through walls under any circumstance
- Vision updates within 50ms of movement/destruction
- Network traffic remains under 5KB/s per player
- No visible lag or jitter in player movement
- Wallhack prevention through server-side filtering

## 💻 Code Guidelines

- Follow existing TypeScript patterns in the codebase
- Add comprehensive logging for debugging (can be removed later)
- Write unit tests for critical calculations
- Document complex algorithms with comments
- Keep systems modular and loosely coupled

## 🤔 Thinking Approach

Before implementing, think through:
1. How will collision detection integrate with existing movement system?
2. What's the most efficient vision calculation for 8 players?
3. How to handle edge cases like spawn positions inside walls?
4. What data structure best represents visibility state?

## 💡 Remember

At 480x270 with only 8 players, performance is not a concern. Focus on correctness and security first. The pixel grid makes many calculations trivial - use this to your advantage.

## 📊 Example Code Structure

```typescript
// VisionSystem.ts
interface VisionState {
  playerId: string;
  visibleTiles: Set<string>;
  visiblePlayers: Set<string>;
  lastCalculated: number;
}

// GameStateSystem.ts
private checkPlayerWallCollision(
  player: PlayerState, 
  newPosition: Vector2
): CollisionResult {
  // Use Matter.js collision detection
}

// GameRoom.ts
private filterStateForPlayer(
  gameState: GameState, 
  playerId: string
): FilteredGameState {
  // Only include visible entities
}
```

## 🚀 Getting Started

1. Start with player collision system (builds on existing physics)
2. Then implement vision calculations (needed for filtering)
3. Finally add visibility filtering (depends on vision)
4. Test each system independently before integration 