# ⚙️ PHYSICS ARCHITECTURE

## Recommended Approach: Server-Only Physics

After careful consideration for a multiplayer destructible shooter, I recommend:

### **Server-Side Physics (Matter.js) + Client-Side Interpolation**

## Why This Architecture?

### 1. **Security & Fairness**
- Server authority prevents cheating
- All collision detection is server-verified
- No client can manipulate physics state

### 2. **Consistency**
- All players see the same physics results
- Destruction effects are synchronized
- No divergent physics simulations

### 3. **Performance**
- Clients only render, no physics calculations
- Server optimizes physics with spatial partitioning
- Reduced client CPU usage

## Implementation Architecture

### Server Physics System
```typescript
// server/src/systems/PhysicsSystem.ts
import Matter from 'matter-js';
import { IServerSystem } from '@/interfaces/IServerSystem';
import { Vector2, PlayerState, WallState, ProjectileState } from '@shared/types';

export class PhysicsSystem implements IServerSystem {
  private engine: Matter.Engine;
  private world: Matter.World;
  private bodies: Map<string, Matter.Body> = new Map();
  
  // Collision categories
  private readonly CATEGORY = {
    PLAYER: 0x0001,
    WALL: 0x0002,
    PROJECTILE: 0x0004,
    SENSOR: 0x0008
  };
  
  constructor() {
    this.engine = Matter.Engine.create();
    this.world = this.engine.world;
    
    // Configure physics
    this.engine.gravity.y = 0; // Top-down game
    this.engine.timing.timeScale = 1;
    
    // Optimize performance
    this.engine.enableSleeping = true;
    this.engine.constraintIterations = 2; // Lower for performance
    this.engine.positionIterations = 6;
    this.engine.velocityIterations = 4;
  }
  
  initialize(): void {
    // Set up collision events
    Matter.Events.on(this.engine, 'collisionStart', this.handleCollisionStart.bind(this));
    Matter.Events.on(this.engine, 'collisionEnd', this.handleCollisionEnd.bind(this));
  }
  
  createPlayer(playerId: string, position: Vector2): Matter.Body {
    const body = Matter.Bodies.circle(position.x, position.y, 15, {
      id: playerId,
      label: 'player',
      friction: 0.1,
      frictionAir: 0.05,
      restitution: 0.3,
      collisionFilter: {
        category: this.CATEGORY.PLAYER,
        mask: this.CATEGORY.WALL | this.CATEGORY.PLAYER
      }
    });
    
    Matter.World.add(this.world, body);
    this.bodies.set(playerId, body);
    return body;
  }
  
  createWall(wallId: string, x: number, y: number, width: number, height: number): Matter.Body {
    const body = Matter.Bodies.rectangle(x + width/2, y + height/2, width, height, {
      id: wallId,
      label: 'wall',
      isStatic: true,
      friction: 0.8,
      restitution: 0.1,
      collisionFilter: {
        category: this.CATEGORY.WALL,
        mask: this.CATEGORY.PLAYER | this.CATEGORY.PROJECTILE
      }
    });
    
    Matter.World.add(this.world, body);
    this.bodies.set(wallId, body);
    return body;
  }
  
  createProjectile(projectileId: string, position: Vector2, velocity: Vector2): Matter.Body {
    const body = Matter.Bodies.circle(position.x, position.y, 2, {
      id: projectileId,
      label: 'projectile',
      isSensor: true, // No physics collision, just detection
      velocity: velocity,
      frictionAir: 0,
      collisionFilter: {
        category: this.CATEGORY.PROJECTILE,
        mask: this.CATEGORY.WALL | this.CATEGORY.PLAYER
      }
    });
    
    Matter.World.add(this.world, body);
    this.bodies.set(projectileId, body);
    return body;
  }
  
  update(deltaTime: number): void {
    // Fixed timestep for deterministic physics
    Matter.Engine.update(this.engine, 16.666); // 60 FPS
  }
  
  applyPlayerInput(playerId: string, input: Vector2, speed: number): void {
    const body = this.bodies.get(playerId);
    if (!body) return;
    
    // Apply velocity (not force) for responsive controls
    Matter.Body.setVelocity(body, {
      x: input.x * speed,
      y: input.y * speed
    });
  }
  
  damageWall(wallId: string, damageX: number, damageY: number, radius: number): void {
    const wallBody = this.bodies.get(wallId);
    if (!wallBody) return;
    
    // For destructible walls, we need to modify the physics body
    // This is complex with Matter.js, so we'll use a different approach:
    // 1. Remove the old body
    // 2. Create new bodies for the remaining parts
    
    // For now, just remove if destroyed
    if (this.isWallDestroyed(wallId)) {
      Matter.World.remove(this.world, wallBody);
      this.bodies.delete(wallId);
    }
  }
  
  private handleCollisionStart(event: Matter.IEventCollision<Matter.Engine>): void {
    const pairs = event.pairs;
    
    for (const pair of pairs) {
      const { bodyA, bodyB } = pair;
      
      // Projectile hit wall
      if (this.isProjectileWallCollision(bodyA, bodyB)) {
        const projectile = bodyA.label === 'projectile' ? bodyA : bodyB;
        const wall = bodyA.label === 'wall' ? bodyA : bodyB;
        
        this.onProjectileHitWall(projectile.id, wall.id, {
          x: projectile.position.x,
          y: projectile.position.y
        });
      }
      
      // Projectile hit player
      if (this.isProjectilePlayerCollision(bodyA, bodyB)) {
        const projectile = bodyA.label === 'projectile' ? bodyA : bodyB;
        const player = bodyA.label === 'player' ? bodyA : bodyB;
        
        this.onProjectileHitPlayer(projectile.id, player.id);
      }
    }
  }
  
  private isProjectileWallCollision(a: Matter.Body, b: Matter.Body): boolean {
    return (a.label === 'projectile' && b.label === 'wall') ||
           (a.label === 'wall' && b.label === 'projectile');
  }
  
  private isProjectilePlayerCollision(a: Matter.Body, b: Matter.Body): boolean {
    return (a.label === 'projectile' && b.label === 'player') ||
           (a.label === 'player' && b.label === 'projectile');
  }
  
  // These would emit events to game logic
  private onProjectileHitWall(projectileId: string, wallId: string, position: Vector2): void {
    // Emit event for game logic to handle
  }
  
  private onProjectileHitPlayer(projectileId: string, playerId: string): void {
    // Emit event for game logic to handle
  }
  
  private isWallDestroyed(wallId: string): boolean {
    // Check with game state
    return false;
  }
  
  getBodyPosition(id: string): Vector2 | null {
    const body = this.bodies.get(id);
    return body ? { x: body.position.x, y: body.position.y } : null;
  }
  
  removeBody(id: string): void {
    const body = this.bodies.get(id);
    if (body) {
      Matter.World.remove(this.world, body);
      this.bodies.delete(id);
    }
  }
}
```

### Client Interpolation System
```typescript
// src/client/systems/InterpolationSystem.ts
export class InterpolationSystem implements IGameSystem {
  private entities: Map<string, InterpolatedEntity> = new Map();
  private interpolationDelay = 100; // ms
  
  updateEntityState(id: string, newState: EntityState): void {
    let entity = this.entities.get(id);
    if (!entity) {
      entity = new InterpolatedEntity(id);
      this.entities.set(id, entity);
    }
    
    entity.addState({
      position: newState.position,
      rotation: newState.rotation,
      timestamp: Date.now()
    });
  }
  
  update(delta: number): void {
    const renderTime = Date.now() - this.interpolationDelay;
    
    for (const entity of this.entities.values()) {
      const interpolated = entity.getInterpolatedState(renderTime);
      if (interpolated) {
        // Update visual representation
        this.updateVisual(entity.id, interpolated);
      }
    }
  }
  
  private updateVisual(id: string, state: InterpolatedState): void {
    // Update Phaser sprite position smoothly
    const sprite = this.getSprite(id);
    if (sprite) {
      sprite.x = state.position.x;
      sprite.y = state.position.y;
      sprite.rotation = state.rotation;
    }
  }
}

class InterpolatedEntity {
  private states: TimestampedState[] = [];
  private maxStates = 20;
  
  constructor(public id: string) {}
  
  addState(state: TimestampedState): void {
    this.states.push(state);
    
    // Keep only recent states
    if (this.states.length > this.maxStates) {
      this.states.shift();
    }
  }
  
  getInterpolatedState(renderTime: number): InterpolatedState | null {
    // Find two states to interpolate between
    let older: TimestampedState | null = null;
    let newer: TimestampedState | null = null;
    
    for (let i = 0; i < this.states.length - 1; i++) {
      if (this.states[i].timestamp <= renderTime && 
          this.states[i + 1].timestamp >= renderTime) {
        older = this.states[i];
        newer = this.states[i + 1];
        break;
      }
    }
    
    if (!older || !newer) {
      // Use latest state if no interpolation possible
      return this.states[this.states.length - 1] || null;
    }
    
    // Linear interpolation
    const total = newer.timestamp - older.timestamp;
    const progress = (renderTime - older.timestamp) / total;
    
    return {
      position: {
        x: older.position.x + (newer.position.x - older.position.x) * progress,
        y: older.position.y + (newer.position.y - older.position.y) * progress
      },
      rotation: older.rotation + (newer.rotation - older.rotation) * progress
    };
  }
}
```

## Destructible Walls Physics

### Challenge: Dynamic Physics Bodies

Matter.js doesn't natively support partial destruction of bodies. Solutions:

### Option 1: Compound Bodies (Recommended)
```typescript
// Create walls from multiple small bodies
createDestructibleWall(x: number, y: number, width: number, height: number): void {
  const sliceWidth = width / 5; // 5 slices
  const parts: Matter.Body[] = [];
  
  for (let i = 0; i < 5; i++) {
    const slice = Matter.Bodies.rectangle(
      x + (i * sliceWidth) + sliceWidth/2,
      y + height/2,
      sliceWidth,
      height,
      {
        isStatic: true,
        label: 'wall-slice',
        collisionFilter: {
          category: this.CATEGORY.WALL,
          mask: this.CATEGORY.PLAYER | this.CATEGORY.PROJECTILE
        }
      }
    );
    
    parts.push(slice);
  }
  
  // Create compound body
  const wall = Matter.Body.create({
    parts: parts,
    isStatic: true
  });
  
  Matter.World.add(this.world, wall);
}

// Destroy individual slices
destroyWallSlice(wallBody: Matter.Body, sliceIndex: number): void {
  if (wallBody.parts.length > sliceIndex + 1) { // +1 for parent body
    const slice = wallBody.parts[sliceIndex + 1];
    Matter.Composite.remove(this.world, slice);
  }
}
```

### Option 2: Grid-Based Collision
```typescript
// Maintain a collision grid separate from physics bodies
class CollisionGrid {
  private grid: boolean[][];
  private cellSize = 5; // pixels
  
  constructor(width: number, height: number) {
    const cols = Math.ceil(width / this.cellSize);
    const rows = Math.ceil(height / this.cellSize);
    this.grid = Array(rows).fill(null).map(() => Array(cols).fill(true));
  }
  
  damageAt(x: number, y: number, radius: number): void {
    const startX = Math.floor((x - radius) / this.cellSize);
    const endX = Math.ceil((x + radius) / this.cellSize);
    const startY = Math.floor((y - radius) / this.cellSize);
    const endY = Math.ceil((y + radius) / this.cellSize);
    
    for (let row = startY; row <= endY; row++) {
      for (let col = startX; col <= endX; col++) {
        if (this.isInBounds(row, col)) {
          const dist = Math.sqrt(
            Math.pow((col * this.cellSize) - x, 2) +
            Math.pow((row * this.cellSize) - y, 2)
          );
          
          if (dist <= radius) {
            this.grid[row][col] = false; // Destroyed
          }
        }
      }
    }
  }
  
  checkCollision(x: number, y: number): boolean {
    const col = Math.floor(x / this.cellSize);
    const row = Math.floor(y / this.cellSize);
    return this.isInBounds(row, col) && this.grid[row][col];
  }
}
```

## Performance Optimizations

### 1. **Spatial Partitioning**
```typescript
// Built into Matter.js with broadphase
this.engine.detector = Matter.Detector.create({
  bodies: [],
  pairs: Matter.Pairs.create()
});
```

### 2. **Sleep Mode**
```typescript
// Enable sleeping for static/slow bodies
this.engine.enableSleeping = true;

// Configure sleep threshold
Matter.Sleeping.set(body, true);
```

### 3. **Fixed Timestep**
```typescript
// Always use fixed timestep for consistency
const FIXED_TIMESTEP = 16.666; // 60 FPS
let accumulator = 0;

update(deltaTime: number): void {
  accumulator += deltaTime;
  
  while (accumulator >= FIXED_TIMESTEP) {
    Matter.Engine.update(this.engine, FIXED_TIMESTEP);
    accumulator -= FIXED_TIMESTEP;
  }
}
```

## Network Synchronization

### State Snapshot
```typescript
interface PhysicsSnapshot {
  timestamp: number;
  bodies: {
    id: string;
    position: Vector2;
    velocity: Vector2;
    angle: number;
    angularVelocity: number;
  }[];
}

getSnapshot(): PhysicsSnapshot {
  const bodies = [];
  
  for (const [id, body] of this.bodies) {
    if (!body.isStatic) {
      bodies.push({
        id,
        position: { x: body.position.x, y: body.position.y },
        velocity: { x: body.velocity.x, y: body.velocity.y },
        angle: body.angle,
        angularVelocity: body.angularVelocity
      });
    }
  }
  
  return {
    timestamp: Date.now(),
    bodies
  };
}
```

## Why Not Client Physics?

### ❌ Problems with Client-Side Physics:
1. **Divergence**: Different results on each client
2. **Cheating**: Easy to manipulate
3. **Sync Issues**: Destruction states mismatch
4. **Complexity**: Reconciliation is very hard

### ✅ Server-Only Benefits:
1. **Authority**: Single source of truth
2. **Security**: No physics cheating
3. **Simplicity**: Clients just render
4. **Consistency**: Everyone sees the same thing

This architecture provides a solid foundation for your multiplayer destructible shooter! 