import { ProjectileState, PlayerState, WallState, ExplosionEvent, WallDamageEvent, PlayerDamageEvent, Vector2 } from '../../shared/types';
import { GAME_CONFIG } from '../../shared/constants';
import Matter from 'matter-js';
import { PhysicsSystem } from './PhysicsSystem';
import { WeaponSystem } from './WeaponSystem';
import { DestructionSystem } from './DestructionSystem';
import { 
  calculateSliceIndex,
  getSliceDimension,
  shouldSliceAllowPenetration
} from '../utils/wallSliceHelpers';

export class ProjectileSystem {
  private projectiles: Map<string, ProjectileState>;
  private physics: PhysicsSystem;
  private weaponSystem: WeaponSystem;
  private destructionSystem: DestructionSystem;
  private projectileBodies: Map<string, Matter.Body>;
  private previousPositions: Map<string, Vector2>;
  private recentCollisions: Map<string, Map<string, number>>; // projectileId -> wallId -> timestamp
  private explosionQueue: ExplosionEvent[] = [];
  
  // Grenade physics constants
  private readonly GRENADE_RADIUS = 2;
  private readonly GRENADE_GROUND_FRICTION = 0.85; // per second - increased from 0.95 for faster slowdown
  private readonly GRENADE_BOUNCE_DAMPING = 0.7;  // energy retained after bounce
  private readonly GRENADE_WALL_FRICTION = 0.85;  // tangential velocity retained
  private readonly GRENADE_MIN_BOUNCE_SPEED = 10; // minimum speed to bounce
  private readonly GRENADE_COLLISION_COOLDOWN = 200; // ms between collisions with same wall
  private readonly GRENADE_SEPARATION_DISTANCE = 3; // extra pixels from wall
  private readonly GRENADE_VELOCITY_THRESHOLD = 5; // speed below which we apply heavy damping
  
  constructor(physics: PhysicsSystem, weaponSystem: WeaponSystem, destructionSystem: DestructionSystem) {
    this.projectiles = new Map();
    this.physics = physics;
    this.weaponSystem = weaponSystem;
    this.destructionSystem = destructionSystem;
    this.projectileBodies = new Map();
    this.previousPositions = new Map();
    this.recentCollisions = new Map();
  }
  
  // Create a new projectile
  createProjectile(
    type: 'bullet' | 'rocket' | 'grenade' | 'grenadelauncher' | 'smokegrenade' | 'flashbang',
    position: Vector2,
    velocity: Vector2,
    ownerId: string,
    damage: number,
    options: {
      range?: number;
      explosionRadius?: number;
      chargeLevel?: number;
      fuseTime?: number;
    } = {}
  ): ProjectileState {
    const projectileId = this.weaponSystem.generateProjectileId();
    
    const projectile: ProjectileState = {
      id: projectileId,
      position: { ...position },
      velocity: { ...velocity },
      type,
      ownerId,
      damage,
      timestamp: Date.now(),
      range: options.range || 300,
      traveledDistance: 0,
      isExploded: false,
      explosionRadius: options.explosionRadius,
      chargeLevel: options.chargeLevel,
      fuseTime: options.fuseTime
    };
    
    // Debug grenade creation
    if (type === 'grenade' || type === 'smokegrenade' || type === 'flashbang') {
      const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
      console.log(`💣 ${type.toUpperCase()} CREATED:`);
      console.log(`   ID: ${projectileId}`);
      console.log(`   Position: (${position.x.toFixed(1)}, ${position.y.toFixed(1)})`);
      console.log(`   Velocity: (${velocity.x.toFixed(1)}, ${velocity.y.toFixed(1)}) = ${speed.toFixed(1)} px/s`);
      console.log(`   Fuse Time: ${options.fuseTime}ms`);
      console.log(`   Explosion Radius: ${options.explosionRadius}`);
    }
    
    // Debug rocket creation
    if (type === 'rocket') {
      const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
      console.log(`🚀 ROCKET CREATED:`);
      console.log(`   ID: ${projectileId}`);
      console.log(`   Position: (${position.x.toFixed(1)}, ${position.y.toFixed(1)})`);
      console.log(`   Velocity: (${velocity.x.toFixed(1)}, ${velocity.y.toFixed(1)}) = ${speed.toFixed(1)} px/s`);
      console.log(`   Range: ${projectile.range}`);
      console.log(`   Damage: ${damage}`);
      console.log(`   Explosion Radius: ${options.explosionRadius || 50}`);
    }
    
    this.projectiles.set(projectileId, projectile);
    this.recentCollisions.set(projectileId, new Map());
    
    // Only create physics bodies for grenades and thrown weapons
    // Rockets and bullets use manual physics for reliable collision detection
    if (type === 'grenade' || type === 'grenadelauncher' || type === 'smokegrenade' || type === 'flashbang') {
      const body = this.createProjectileBody(projectile);
      this.projectileBodies.set(projectileId, body);
      this.physics.addActiveBody(projectileId);
    }
    
    return projectile;
  }
  
  // Create physics body for projectile
  private createProjectileBody(projectile: ProjectileState): Matter.Body {
    let body: Matter.Body;
    
    switch (projectile.type) {
      case 'grenade':
        body = Matter.Bodies.circle(
          projectile.position.x,
          projectile.position.y,
          this.GRENADE_RADIUS,
          {
            friction: 0.3,
            frictionAir: 0.01,
            restitution: 0.6, // Bouncy
            label: `grenade:${projectile.id}`,
            render: { visible: false }
          }
        );
        break;
        
      case 'rocket':
        body = Matter.Bodies.rectangle(
          projectile.position.x,
          projectile.position.y,
          6, 2, // Rocket dimensions
          {
            friction: 0.1,
            frictionAir: 0.05,
            restitution: 0.1,
            label: `rocket:${projectile.id}`,
            render: { visible: false }
          }
        );
        break;
        
      default:
        body = Matter.Bodies.circle(
          projectile.position.x,
          projectile.position.y,
          1,
          {
            friction: 0.1,
            frictionAir: 0.01,
            restitution: 0.1,
            label: `projectile:${projectile.id}`,
            render: { visible: false }
          }
        );
    }
    
    // Set initial velocity
    Matter.Body.setVelocity(body, projectile.velocity);
    
    // Add to physics world
    this.physics.addBody(body);
    
    return body;
  }
  
  // Update all projectiles
  update(deltaTime: number, walls?: Map<string, WallState>): { updateEvents: any[], explodeEvents: any[] } {
    const updateEvents: any[] = [];
    const explodeEvents: any[] = [];
    const projectilesToRemove: string[] = [];
    
    projectileLoop: for (const [projectileId, projectile] of this.projectiles) {
      // Store previous position before updating
      this.previousPositions.set(projectileId, { ...projectile.position });
      
      // Get physics body if it exists (only for grenades now)
      const body = this.projectileBodies.get(projectileId);
      
      // Update position based on projectile type
      if (projectile.type === 'grenade' || projectile.type === 'smokegrenade' || projectile.type === 'flashbang') {
        // Manual physics for grenades with bouncing
        this.updateGrenade(projectile, deltaTime, walls);
      } else if (projectile.type === 'grenadelauncher') {
        // Arc trajectory with gravity for grenade launcher
        this.updateGrenadelauncherProjectile(projectile, deltaTime, walls);
      } else if (body) {
        // Sync position from Matter.js physics body
        projectile.position.x = body.position.x;
        projectile.position.y = body.position.y;
        projectile.velocity.x = body.velocity.x;
        projectile.velocity.y = body.velocity.y;
      } else {
        // Manual position update for bullets and rockets
        projectile.position.x += projectile.velocity.x * (deltaTime / 1000);
        projectile.position.y += projectile.velocity.y * (deltaTime / 1000);
      }
      
      // Add update event for non-bullet projectiles
      if (projectile.type !== 'bullet') {
        updateEvents.push({
          id: projectile.id,
          position: { x: projectile.position.x, y: projectile.position.y }
        });
      }
      
      // Check for fuse timer explosion
      if (projectile.fuseTime && (projectile.type === 'grenade' || projectile.type === 'grenadelauncher' || 
          projectile.type === 'smokegrenade' || projectile.type === 'flashbang')) {
        const timeAlive = Date.now() - projectile.timestamp;
        
        // Debug log for grenades approaching explosion
        if (projectile.type === 'grenade' && timeAlive > projectile.fuseTime - 500 && timeAlive < projectile.fuseTime) {
          console.log(`💣 Grenade ${projectile.id} about to explode: ${timeAlive}ms / ${projectile.fuseTime}ms`);
        }
        
        if (timeAlive >= projectile.fuseTime) {
          console.log(`💥 ${projectile.type} ${projectile.id} exploding! Time alive: ${timeAlive}ms, Fuse time: ${projectile.fuseTime}ms`);
          this.explodeProjectile(projectile);
          
          // Different explosion events based on type
          if (projectile.type === 'smokegrenade') {
            // Smoke grenades create smoke zones instead of damage explosions
            explodeEvents.push({
              id: projectile.id,
              type: 'smoke',
              position: { x: projectile.position.x, y: projectile.position.y },
              radius: GAME_CONFIG.WEAPONS.SMOKEGRENADE.SMOKE_RADIUS
            });
          } else if (projectile.type === 'flashbang') {
            // Flashbangs create flash effects
            explodeEvents.push({
              id: projectile.id,
              type: 'flash',
              position: { x: projectile.position.x, y: projectile.position.y },
              radius: GAME_CONFIG.WEAPONS.FLASHBANG.EFFECT_RADIUS
            });
          } else {
            // Regular explosion
            explodeEvents.push({
              id: projectile.id,
              type: 'explosion',
              position: { x: projectile.position.x, y: projectile.position.y },
              radius: projectile.explosionRadius || 40
            });
          }
          projectilesToRemove.push(projectileId);
          continue;
        }
        
        // Remove grenades that are stuck
        const speed = Math.sqrt(projectile.velocity.x ** 2 + projectile.velocity.y ** 2);
        if (speed < this.GRENADE_MIN_BOUNCE_SPEED) {
          this.explodeProjectile(projectile);
          explodeEvents.push({
            id: projectile.id,
            position: { x: projectile.position.x, y: projectile.position.y },
            radius: projectile.explosionRadius || 40
          });
          projectilesToRemove.push(projectileId);
          continue;
        }
      }
      
      // Check wall collisions for rockets
      if (walls && projectile.type === 'rocket') {
        const wallCollision = this.checkWallCollision(projectile, walls);
        if (wallCollision.hit) {
          // Don't remove rocket yet - let GameStateSystem handle wall damage
          // Just mark it as exploded and create the explosion event
          if (!projectile.isExploded) {
            this.explodeProjectile(projectile);
            explodeEvents.push({
              id: projectile.id,
              position: { x: projectile.position.x, y: projectile.position.y },
              radius: projectile.explosionRadius || 50
            });
          }
          // Skip further processing but don't remove yet
          continue;
        }
      }
      
      // Update traveled distance
      const speed = Math.sqrt(projectile.velocity.x ** 2 + projectile.velocity.y ** 2);
      projectile.traveledDistance += speed * (deltaTime / 1000);
      
      // Check if projectile has exceeded its range
      if (projectile.traveledDistance >= projectile.range) {
        if (projectile.type === 'grenade') {
          this.explodeProjectile(projectile);
          explodeEvents.push({
            id: projectile.id,
            position: { x: projectile.position.x, y: projectile.position.y },
            radius: projectile.explosionRadius || 40
          });
        }
        projectilesToRemove.push(projectileId);
        continue;
      }
      
      // Check for boundary collisions (grenades handled in updateGrenade)
      if (projectile.type !== 'grenade' && this.checkBoundaryCollision(projectile)) {
        if (projectile.type === 'rocket') {
          this.explodeProjectile(projectile);
          explodeEvents.push({
            id: projectile.id,
            position: { x: projectile.position.x, y: projectile.position.y },
            radius: projectile.explosionRadius || 50
          });
        }
        projectilesToRemove.push(projectileId);
      }
      
      // Remove projectiles that are extremely far out of bounds
      const maxBounds = 1000;
      if (Math.abs(projectile.position.x) > maxBounds || Math.abs(projectile.position.y) > maxBounds) {
        projectilesToRemove.push(projectileId);
      }
      
      // Remove exploded projectiles (after GameStateSystem has processed them)
      if (projectile.isExploded && projectile.type !== 'grenade') {
        projectilesToRemove.push(projectileId);
      }
    }
    
    // Remove expired projectiles
    for (const projectileId of projectilesToRemove) {
      this.removeProjectile(projectileId);
    }
    
    return { updateEvents, explodeEvents };
  }
  
  // Arc trajectory update for grenade launcher projectiles
  private updateGrenadelauncherProjectile(projectile: ProjectileState, deltaTime: number, walls?: Map<string, WallState>): void {
    const deltaSeconds = deltaTime / 1000;
    const gravity = GAME_CONFIG.WEAPONS.GRENADELAUNCHER.ARC_GRAVITY;
    
    // Apply gravity to velocity
    projectile.velocity.y += gravity * deltaSeconds;
    
    // Update position
    const newX = projectile.position.x + projectile.velocity.x * deltaSeconds;
    const newY = projectile.position.y + projectile.velocity.y * deltaSeconds;
    
    // Check for wall collision
    if (walls) {
      const collision = this.checkSimpleWallCollision(
        { x: projectile.position.x, y: projectile.position.y },
        { x: newX, y: newY },
        walls
      );
      
      if (collision) {
        // Grenade launcher projectiles bounce with reduced velocity
        const bounceDamping = 0.4;
        
        // Reflect velocity off the normal
        const dot = projectile.velocity.x * collision.normal.x + projectile.velocity.y * collision.normal.y;
        projectile.velocity.x = (projectile.velocity.x - 2 * dot * collision.normal.x) * bounceDamping;
        projectile.velocity.y = (projectile.velocity.y - 2 * dot * collision.normal.y) * bounceDamping;
        
        // Position at collision point
        projectile.position.x = collision.point.x + collision.normal.x * 2;
        projectile.position.y = collision.point.y + collision.normal.y * 2;
      } else {
        // No collision, update position
        projectile.position.x = newX;
        projectile.position.y = newY;
      }
    } else {
      // No walls, just update position
      projectile.position.x = newX;
      projectile.position.y = newY;
    }
    
    // Check boundary collision
    if (projectile.position.x < 0 || projectile.position.x > GAME_CONFIG.GAME_WIDTH ||
        projectile.position.y < 0 || projectile.position.y > GAME_CONFIG.GAME_HEIGHT) {
      // Explode on boundary hit
      projectile.velocity.x = 0;
      projectile.velocity.y = 0;
    }
  }
  
  // Simple projectile-wall collision check
  private checkSimpleWallCollision(
    from: Vector2,
    to: Vector2,
    walls: Map<string, WallState>
  ): { normal: Vector2, point: Vector2 } | null {
    for (const [wallId, wall] of walls) {
      // Simple AABB check
      if (to.x >= wall.position.x && to.x <= wall.position.x + wall.width &&
          to.y >= wall.position.y && to.y <= wall.position.y + wall.height) {
        
        // 🔧 PIERCING FIX: Check if slice allows penetration based on health
        const sliceIndex = calculateSliceIndex(wall, to);
        if (shouldSliceAllowPenetration(wall.material, wall.sliceHealth[sliceIndex], wall.maxHealth)) {
          continue; // Pass through slice that allows penetration
        }
        
        // Calculate collision normal based on which edge we hit
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        
        let normal = { x: 0, y: 0 };
        if (Math.abs(dx) > Math.abs(dy)) {
          normal.x = dx > 0 ? -1 : 1;
        } else {
          normal.y = dy > 0 ? -1 : 1;
        }
        
        return { normal, point: to };
      }
    }
    return null;
  }
  
  // Manual physics update for grenades
  private updateGrenade(grenade: ProjectileState, deltaTime: number, walls?: Map<string, WallState>): void {
    const deltaSeconds = deltaTime / 1000;
    const prevPos = { ...grenade.position };
    
    // Apply ground friction
    grenade.velocity.x *= Math.pow(this.GRENADE_GROUND_FRICTION, deltaSeconds);
    grenade.velocity.y *= Math.pow(this.GRENADE_GROUND_FRICTION, deltaSeconds);
    
    // Stop grenade if moving very slowly
    const speed = Math.sqrt(grenade.velocity.x ** 2 + grenade.velocity.y ** 2);
    if (speed < 2) {
      grenade.velocity.x = 0;
      grenade.velocity.y = 0;
      return; // Don't update position
    }
    
    // Calculate new position
    const newX = grenade.position.x + grenade.velocity.x * deltaSeconds;
    const newY = grenade.position.y + grenade.velocity.y * deltaSeconds;
    
    // Swept sphere collision detection
    const collision = this.checkGrenadeMovement(prevPos, { x: newX, y: newY }, walls);
    
    if (collision) {
      // Handle the collision
      this.handleGrenadeCollision(grenade, collision);
    } else {
      // No collision, update position
      grenade.position.x = newX;
      grenade.position.y = newY;
    }
    
    // Handle boundary collisions
    this.handleGrenadeBoundaryCollision(grenade);
  }
  
  // Check grenade movement for collisions
  private checkGrenadeMovement(
    from: Vector2, 
    to: Vector2, 
    walls?: Map<string, WallState>
  ): { type: 'wall' | 'boundary', normal: Vector2, point: Vector2, wall?: WallState } | null {
    if (!walls) return null;
    
    // Calculate movement vector
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance < 0.001) return null; // Not moving
    
    // Number of steps based on speed
    const steps = Math.max(1, Math.ceil(distance / this.GRENADE_RADIUS));
    
    // Check each step
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const checkX = from.x + dx * t;
      const checkY = from.y + dy * t;
      
      // Check all walls
      for (const [wallId, wall] of walls) {
        // Expand wall bounds by grenade radius
        const expandedBounds = {
          left: wall.position.x - this.GRENADE_RADIUS,
          right: wall.position.x + wall.width + this.GRENADE_RADIUS,
          top: wall.position.y - this.GRENADE_RADIUS,
          bottom: wall.position.y + wall.height + this.GRENADE_RADIUS
        };
        
        // Check if grenade center is inside expanded bounds
        if (checkX >= expandedBounds.left && checkX <= expandedBounds.right &&
            checkY >= expandedBounds.top && checkY <= expandedBounds.bottom) {
          
          // Find closest point on actual wall
          const closestX = Math.max(wall.position.x, Math.min(checkX, wall.position.x + wall.width));
          const closestY = Math.max(wall.position.y, Math.min(checkY, wall.position.y + wall.height));
          
          // Check if we're actually colliding
          const distX = checkX - closestX;
          const distY = checkY - closestY;
          const distSq = distX * distX + distY * distY;
          
          if (distSq < this.GRENADE_RADIUS * this.GRENADE_RADIUS) {
            // 🔧 PIERCING FIX: Check if slice allows penetration based on health
            const sliceIndex = calculateSliceIndex(wall, { x: closestX, y: closestY });
            
            // If this slice allows penetration, grenade should pass through
            if (shouldSliceAllowPenetration(wall.material, wall.sliceHealth[sliceIndex], wall.maxHealth)) {
              continue; // Skip this collision, grenade passes through slice that allows penetration
            }
            
            // Slice is intact - proceed with normal collision
            // Calculate normal
            const dist = Math.sqrt(distSq);
            const normal = dist > 0 
              ? { x: distX / dist, y: distY / dist }
              : { x: 0, y: -1 }; // Default to up if exactly on edge
            
            return {
              type: 'wall',
              normal,
              point: { x: closestX, y: closestY },
              wall
            };
          }
        }
      }
    }
    
    return null;
  }
  
  // Handle grenade collision
  private handleGrenadeCollision(
    grenade: ProjectileState, 
    collision: { type: 'wall' | 'boundary', normal: Vector2, point: Vector2, wall?: WallState }
  ): void {
    // Check collision cooldown
    if (collision.wall) {
      const collisionHistory = this.recentCollisions.get(grenade.id);
      const lastCollisionTime = collisionHistory?.get(collision.wall.id) || 0;
      const now = Date.now();
      
      if (now - lastCollisionTime < this.GRENADE_COLLISION_COOLDOWN) {
        return; // Skip this collision
      }
      
      // Record collision
      if (collisionHistory) {
        collisionHistory.set(collision.wall.id, now);
      }
    }
    
    // Calculate dot product to check if moving towards wall
    const dot = grenade.velocity.x * collision.normal.x + grenade.velocity.y * collision.normal.y;
    
    if (dot < 0) {
      // Moving towards wall, apply reflection
      // v' = v - 2(v·n)n
      grenade.velocity.x -= 2 * dot * collision.normal.x;
      grenade.velocity.y -= 2 * dot * collision.normal.y;
      
      // Apply bounce damping
      grenade.velocity.x *= this.GRENADE_BOUNCE_DAMPING;
      grenade.velocity.y *= this.GRENADE_BOUNCE_DAMPING;
      
      // Apply wall friction to tangential component
      const tangentX = -collision.normal.y;
      const tangentY = collision.normal.x;
      const tangentVel = grenade.velocity.x * tangentX + grenade.velocity.y * tangentY;
      
      grenade.velocity.x = collision.normal.x * (grenade.velocity.x * collision.normal.x + grenade.velocity.y * collision.normal.y) +
                          tangentX * tangentVel * this.GRENADE_WALL_FRICTION;
      grenade.velocity.y = collision.normal.y * (grenade.velocity.x * collision.normal.x + grenade.velocity.y * collision.normal.y) +
                          tangentY * tangentVel * this.GRENADE_WALL_FRICTION;
      
      // Apply extra damping for slow speeds
      const speed = Math.sqrt(grenade.velocity.x ** 2 + grenade.velocity.y ** 2);
      if (speed < this.GRENADE_MIN_BOUNCE_SPEED) {
        grenade.velocity.x *= 0.5;
        grenade.velocity.y *= 0.5;
      }
    }
    
    // Position correction - push grenade away from collision
    const pushDistance = this.GRENADE_RADIUS + 1; // Small epsilon
    grenade.position.x = collision.point.x + collision.normal.x * pushDistance;
    grenade.position.y = collision.point.y + collision.normal.y * pushDistance;
  }
  
  // Handle grenade boundary collisions
  private handleGrenadeBoundaryCollision(grenade: ProjectileState): void {
    let bounced = false;
    
    // Left boundary
    if (grenade.position.x - this.GRENADE_RADIUS <= 0) {
      grenade.position.x = this.GRENADE_RADIUS;
      if (grenade.velocity.x < 0) {
        grenade.velocity.x = -grenade.velocity.x * this.GRENADE_BOUNCE_DAMPING;
        grenade.velocity.y *= this.GRENADE_WALL_FRICTION;
        bounced = true;
      }
    }
    
    // Right boundary
    if (grenade.position.x + this.GRENADE_RADIUS >= GAME_CONFIG.GAME_WIDTH) {
      grenade.position.x = GAME_CONFIG.GAME_WIDTH - this.GRENADE_RADIUS;
      if (grenade.velocity.x > 0) {
        grenade.velocity.x = -grenade.velocity.x * this.GRENADE_BOUNCE_DAMPING;
        grenade.velocity.y *= this.GRENADE_WALL_FRICTION;
        bounced = true;
      }
    }
    
    // Top boundary
    if (grenade.position.y - this.GRENADE_RADIUS <= 0) {
      grenade.position.y = this.GRENADE_RADIUS;
      if (grenade.velocity.y < 0) {
        grenade.velocity.y = -grenade.velocity.y * this.GRENADE_BOUNCE_DAMPING;
        grenade.velocity.x *= this.GRENADE_WALL_FRICTION;
        bounced = true;
      }
    }
    
    // Bottom boundary
    if (grenade.position.y + this.GRENADE_RADIUS >= GAME_CONFIG.GAME_HEIGHT) {
      grenade.position.y = GAME_CONFIG.GAME_HEIGHT - this.GRENADE_RADIUS;
      if (grenade.velocity.y > 0) {
        grenade.velocity.y = -grenade.velocity.y * this.GRENADE_BOUNCE_DAMPING;
        grenade.velocity.x *= this.GRENADE_WALL_FRICTION;
        bounced = true;
      }
    }
    
    // Apply extra damping for slow speeds after bounce
    if (bounced) {
      const speed = Math.sqrt(grenade.velocity.x ** 2 + grenade.velocity.y ** 2);
      if (speed < this.GRENADE_MIN_BOUNCE_SPEED) {
        grenade.velocity.x *= 0.5;
        grenade.velocity.y *= 0.5;
      }
    }
  }
  
  // Check collision with game boundaries
  private checkBoundaryCollision(projectile: ProjectileState): boolean {
    return (
      projectile.position.x < 0 || 
      projectile.position.x > GAME_CONFIG.GAME_WIDTH ||
      projectile.position.y < 0 || 
      projectile.position.y > GAME_CONFIG.GAME_HEIGHT
    );
  }
  
  // Check collision with walls
  checkWallCollision(projectile: ProjectileState, walls: Map<string, WallState>): { hit: boolean; wall?: WallState; sliceIndex?: number } {
    // Get the stored previous position from before the update
    const previousPosition = this.previousPositions.get(projectile.id) || projectile.position;
    
    // Calculate movement distance
    const dx = projectile.position.x - previousPosition.x;
    const dy = projectile.position.y - previousPosition.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // For rockets, subdivide the path to catch fast movement through thin walls
    const steps = projectile.type === 'rocket' && distance > 2 ? Math.ceil(distance / 2) : 1;
    
    for (const [wallId, wall] of walls) {
      // Check multiple points along the path for rockets
      for (let step = 0; step < steps; step++) {
        const t = step / steps;
        const t2 = (step + 1) / steps;
        
        const checkStart = {
          x: previousPosition.x + dx * t,
          y: previousPosition.y + dy * t
        };
        const checkEnd = {
          x: previousPosition.x + dx * t2,
          y: previousPosition.y + dy * t2
        };
        
        // Pass appropriate radius for collision detection
        const projectileRadius = projectile.type === 'grenade' ? this.GRENADE_RADIUS : 0;
        const collision = this.checkLineWallCollision(checkStart, checkEnd, wall, projectileRadius);
        
        if (collision.hit) {
          // Debug: Log collision detection
          if (projectile.type === 'rocket') {
            console.log(`🚀 Rocket hit wall ${wallId} at step ${step}/${steps}, slice ${collision.sliceIndex}`);
          }
          return {
            hit: true,
            wall,
            sliceIndex: collision.sliceIndex
          };
        }
      }
    }
    
    return { hit: false };
  }
  
  // Check collision with players
  checkPlayerCollision(projectile: ProjectileState, players: Map<string, PlayerState>): { hit: boolean; player?: PlayerState } {
    for (const [playerId, player] of players) {
      if (playerId === projectile.ownerId || !player.isAlive) continue;
      
      const distance = Math.sqrt(
        Math.pow(projectile.position.x - player.transform.position.x, 2) +
        Math.pow(projectile.position.y - player.transform.position.y, 2)
      );
      
      if (distance <= GAME_CONFIG.PLAYER_SIZE / 2) {
        return { hit: true, player };
      }
    }
    return { hit: false };
  }
  
  // Check if a line segment intersects with a wall
  private checkLineWallCollision(start: Vector2, end: Vector2, wall: WallState, projectileRadius: number = 0): { hit: boolean; sliceIndex?: number } {
    // Expand wall bounds by projectile radius for proper collision detection
    const wallLeft = wall.position.x - projectileRadius;
    const wallRight = wall.position.x + wall.width + projectileRadius;
    const wallTop = wall.position.y - projectileRadius;
    const wallBottom = wall.position.y + wall.height + projectileRadius;
    
    // Use parametric line equation for robust collision detection
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    
    // Calculate t values for intersection with each wall boundary
    let tMin = 0;
    let tMax = 1;
    
    // Check X boundaries
    if (Math.abs(dx) > 0.0001) {
      const t1 = (wallLeft - start.x) / dx;
      const t2 = (wallRight - start.x) / dx;
      
      const tMinX = Math.min(t1, t2);
      const tMaxX = Math.max(t1, t2);
      
      tMin = Math.max(tMin, tMinX);
      tMax = Math.min(tMax, tMaxX);
    } else {
      // Line is vertical - check if it's within wall X bounds
      if (start.x < wallLeft || start.x > wallRight) {
        return { hit: false };
      }
    }
    
    // Check Y boundaries
    if (Math.abs(dy) > 0.0001) {
      const t1 = (wallTop - start.y) / dy;
      const t2 = (wallBottom - start.y) / dy;
      
      const tMinY = Math.min(t1, t2);
      const tMaxY = Math.max(t1, t2);
      
      tMin = Math.max(tMin, tMinY);
      tMax = Math.min(tMax, tMaxY);
    } else {
      // Line is horizontal - check if it's within wall Y bounds
      if (start.y < wallTop || start.y > wallBottom) {
        return { hit: false };
      }
    }
    
    // Check if there's a valid intersection
    if (tMin <= tMax && tMax >= 0 && tMin <= 1) {
      // Calculate hit point using the entry point (tMin)
      const hitX = start.x + dx * Math.max(0, tMin);
      const hitY = start.y + dy * Math.max(0, tMin);
      
      // Calculate which slice was hit (using original wall position, not expanded bounds)
      const sliceIndex = calculateSliceIndex(wall, { x: hitX, y: hitY });
      
      // 🔧 PIERCING FIX: Check if slice allows penetration based on health
      if (shouldSliceAllowPenetration(wall.material, wall.sliceHealth[sliceIndex], wall.maxHealth)) {
        return { hit: false }; // Rocket passes through slice that allows penetration
      }
      
      // Slice is intact - proceed with normal collision
      return {
        hit: true,
        sliceIndex: sliceIndex
      };
    }
    
    return { hit: false };
  }
  
  // Check collision between projectile and wall
  private checkProjectileWallCollision(projectile: ProjectileState, wall: WallState): { hit: boolean; sliceIndex?: number } {
    const projectileSize = projectile.type === 'grenade' ? this.GRENADE_RADIUS : 1;
    
    // Check AABB collision
    if (
      projectile.position.x + projectileSize >= wall.position.x &&
      projectile.position.x - projectileSize <= wall.position.x + wall.width &&
      projectile.position.y + projectileSize >= wall.position.y &&
      projectile.position.y - projectileSize <= wall.position.y + wall.height
    ) {
      // Calculate which slice was hit
      const sliceIndex = calculateSliceIndex(wall, projectile.position);
      
      return {
        hit: true,
        sliceIndex: sliceIndex
      };
    }
    
    return { hit: false };
  }
  
  // Handle projectile collision with wall
  handleWallCollision(projectile: ProjectileState, wall: WallState, sliceIndex: number): WallDamageEvent | null {
    if (projectile.type === 'grenade') {
      // Grenades bounce off walls
      this.handleWallBounce(projectile, wall);
      return null;
    } else if (projectile.type === 'rocket') {
      // Rockets explode on wall hit
      this.explodeProjectile(projectile);
      return this.createWallDamageEvent(wall, sliceIndex, projectile.position, projectile.damage);
    }
    
    return null;
  }
  
  // Handle projectile bouncing off wall
  private handleWallBounce(projectile: ProjectileState, wall: WallState): void {
    const grenadeRadius = this.GRENADE_RADIUS;
    const wallLeft = wall.position.x;
    const wallRight = wall.position.x + wall.width;
    const wallTop = wall.position.y;
    const wallBottom = wall.position.y + wall.height;
    
    // Find the closest point on the wall to the grenade
    const closestX = Math.max(wallLeft, Math.min(projectile.position.x, wallRight));
    const closestY = Math.max(wallTop, Math.min(projectile.position.y, wallBottom));
    
    // Calculate the normal from the closest point to the grenade center
    let normalX = projectile.position.x - closestX;
    let normalY = projectile.position.y - closestY;
    
    // Normalize the normal vector
    const length = Math.sqrt(normalX * normalX + normalY * normalY);
    if (length > 0) {
      normalX /= length;
      normalY /= length;
    } else {
      // Grenade is exactly on wall edge/corner - use velocity to determine normal
      const speed = Math.sqrt(projectile.velocity.x ** 2 + projectile.velocity.y ** 2);
      if (speed > 0) {
        normalX = -projectile.velocity.x / speed;
        normalY = -projectile.velocity.y / speed;
      } else {
        return; // No velocity, no bounce
      }
    }
    
    // Calculate dot product
    const dotProduct = projectile.velocity.x * normalX + projectile.velocity.y * normalY;
    
    // Only bounce if moving towards the wall (dot product is positive when moving towards wall)
    if (dotProduct > 0) {
      const bounceFactor = 0.7;
      
      // Apply reflection formula: v' = v - 2(v·n)n
      projectile.velocity.x = projectile.velocity.x - 2 * dotProduct * normalX;
      projectile.velocity.y = projectile.velocity.y - 2 * dotProduct * normalY;
      
      // Apply bounce damping
      projectile.velocity.x *= bounceFactor;
      projectile.velocity.y *= bounceFactor;
      
      // Additional damping for very slow grenades to prevent micro-bounces
      const newSpeed = Math.sqrt(projectile.velocity.x ** 2 + projectile.velocity.y ** 2);
      if (newSpeed < 5) {
        // Almost stopped - apply heavy damping
        projectile.velocity.x *= 0.5;
        projectile.velocity.y *= 0.5;
      }
    }
    
    // Position correction - push grenade outside of wall
    const overlap = grenadeRadius - length;
    if (overlap > 0 || length < grenadeRadius * 3) {
      // Ensure grenade is pushed far enough from wall
      // Use larger push distance to prevent immediate re-collision
      const minPushDistance = grenadeRadius + 3;
      
      // Also consider velocity - push further if moving fast
      const speed = Math.sqrt(projectile.velocity.x ** 2 + projectile.velocity.y ** 2);
      const velocityFactor = Math.max(1, speed / 50); // Extra push for fast grenades
      const pushDistance = minPushDistance * velocityFactor;
      
      projectile.position.x = closestX + normalX * pushDistance;
      projectile.position.y = closestY + normalY * pushDistance;
    }
    
    // Double-check: if still inside wall, push to nearest edge
    if (projectile.position.x > wallLeft && projectile.position.x < wallRight &&
        projectile.position.y > wallTop && projectile.position.y < wallBottom) {
      // Find distances to each edge
      const distLeft = projectile.position.x - wallLeft;
      const distRight = wallRight - projectile.position.x;
      const distTop = projectile.position.y - wallTop;
      const distBottom = wallBottom - projectile.position.y;
      
      // Push to nearest edge
      const minDist = Math.min(distLeft, distRight, distTop, distBottom);
      if (minDist === distLeft) {
        projectile.position.x = wallLeft - grenadeRadius - 3;
      } else if (minDist === distRight) {
        projectile.position.x = wallRight + grenadeRadius + 3;
      } else if (minDist === distTop) {
        projectile.position.y = wallTop - grenadeRadius - 3;
      } else {
        projectile.position.y = wallBottom + grenadeRadius + 3;
      }
    }
    
    // Ensure we're within game bounds
    projectile.position.x = Math.max(grenadeRadius, Math.min(GAME_CONFIG.GAME_WIDTH - grenadeRadius, projectile.position.x));
    projectile.position.y = Math.max(grenadeRadius, Math.min(GAME_CONFIG.GAME_HEIGHT - grenadeRadius, projectile.position.y));
  }
  
  // Handle projectile collision with player
  handlePlayerCollision(projectile: ProjectileState, player: PlayerState): PlayerDamageEvent {
    // Calculate damage based on projectile type
    let damage = projectile.damage;
    
    if (projectile.type === 'rocket') {
      // Rockets explode on player hit
      this.explodeProjectile(projectile);
    }
    
    return {
      playerId: player.id,
      damage,
      damageType: projectile.type === 'grenade' || projectile.type === 'rocket' ? 'explosion' : 'bullet',
      sourcePlayerId: projectile.ownerId,
      position: { ...projectile.position },
      newHealth: Math.max(0, player.health - damage),
      isKilled: player.health - damage <= 0,
      timestamp: Date.now()
    };
  }
  
  // Mark projectile for explosion
  private explodeProjectile(projectile: ProjectileState): void {
    if (projectile.isExploded) return;
    
    projectile.isExploded = true;
    
    const explosion: ExplosionEvent = {
      position: { x: projectile.position.x, y: projectile.position.y },
      radius: projectile.explosionRadius || 50,
      damage: projectile.damage,
      sourcePlayerId: projectile.ownerId,
      timestamp: Date.now()
    };
    
    this.explosionQueue.push(explosion);
  }
  
  // Get distance from point to wall
  private getDistanceToWall(point: Vector2, wall: WallState): number {
    // Calculate distance to closest point on wall
    const closestX = Math.max(wall.position.x, Math.min(point.x, wall.position.x + wall.width));
    const closestY = Math.max(wall.position.y, Math.min(point.y, wall.position.y + wall.height));
    
    return Math.sqrt(
      Math.pow(point.x - closestX, 2) +
      Math.pow(point.y - closestY, 2)
    );
  }
  
  // Process explosions and return damage events
  processExplosions(players: Map<string, any>, walls: Map<string, WallState>): { 
    playerDamageEvents: PlayerDamageEvent[], 
    wallDamageEvents: WallDamageEvent[],
    explosions: ExplosionEvent[] 
  } {
    const playerDamageEvents: PlayerDamageEvent[] = [];
    const wallDamageEvents: WallDamageEvent[] = [];
    const explosions: ExplosionEvent[] = [...this.explosionQueue];
    
    if (this.explosionQueue.length > 0) {
      console.log(`💥 Processing ${this.explosionQueue.length} explosions`);
    }
    
    for (const explosion of this.explosionQueue) {
      // Add null check for explosion
      if (!explosion || !explosion.position) {
        console.error('Invalid explosion in queue:', explosion);
        continue;
      }
      
      // Damage players in explosion radius
      for (const [playerId, player] of players) {
        if (!player || !player.isAlive || !player.transform?.position) continue;
        
        const distance = Math.sqrt(
          Math.pow(player.transform.position.x - explosion.position.x, 2) +
          Math.pow(player.transform.position.y - explosion.position.y, 2)
        );
        
        if (distance <= explosion.radius) {
          const damageMultiplier = 1 - (distance / explosion.radius);
          const damage = Math.floor(explosion.damage * damageMultiplier);
          
          console.log(`💥 Explosion damages player ${playerId}: ${damage} damage at distance ${distance.toFixed(1)}`);
          
          playerDamageEvents.push({
            playerId,
            damage,
            damageType: 'explosion',
            sourcePlayerId: explosion.sourcePlayerId,
            position: { ...player.transform.position },
            newHealth: Math.max(0, player.health - damage),
            isKilled: player.health - damage <= 0,
            timestamp: Date.now()
          });
        }
      }
      
      // Damage walls in explosion radius
      for (const [wallId, wall] of walls) {
        const distance = this.getDistanceToWall(explosion.position, wall);
        
        if (distance <= explosion.radius) {
          const damageMultiplier = 1 - (distance / explosion.radius);
          const damage = Math.floor(explosion.damage * damageMultiplier);
          
          // Calculate which slices are affected
          const sliceWidth = wall.width / GAME_CONFIG.DESTRUCTION.WALL_SLICES;
          const affectedSlices: number[] = [];
          
          for (let i = 0; i < GAME_CONFIG.DESTRUCTION.WALL_SLICES; i++) {
            const sliceCenterX = wall.position.x + (i + 0.5) * sliceWidth;
            const sliceCenterY = wall.position.y + wall.height / 2;
            const sliceDistance = Math.sqrt(
              Math.pow(sliceCenterX - explosion.position.x, 2) +
              Math.pow(sliceCenterY - explosion.position.y, 2)
            );
            
            if (sliceDistance <= explosion.radius) {
              affectedSlices.push(i);
            }
          }
          
          // Create damage event for each affected slice
          for (const sliceIndex of affectedSlices) {
            const sliceHealth = wall.sliceHealth[sliceIndex];
            const newHealth = Math.max(0, sliceHealth - damage);
            
            wallDamageEvents.push({
              wallId,
              position: { ...explosion.position },
              damage,
              sliceIndex,
              newHealth,
              isDestroyed: newHealth <= 0,
              timestamp: Date.now()
            });
          }
        }
      }
    }
    
    // Clear the explosion queue after processing
    this.explosionQueue = [];
    
    return { playerDamageEvents, wallDamageEvents, explosions };
  }
  
  // Create wall damage event
  private createWallDamageEvent(wall: WallState, sliceIndex: number, position: Vector2, damage: number): WallDamageEvent {
    const currentHealth = wall.sliceHealth[sliceIndex];
    const newHealth = Math.max(0, currentHealth - damage);
    
    return {
      wallId: wall.id,
      position: { ...position },
      damage,
      sliceIndex,
      newHealth,
      isDestroyed: newHealth <= 0,
      timestamp: Date.now()
    };
  }
  
  // Remove projectile
  removeProjectile(projectileId: string): void {
    const body = this.projectileBodies.get(projectileId);
    if (body) {
      this.physics.removeBody(body);
      this.projectileBodies.delete(projectileId);
      
      // Stop tracking this body for physics
      this.physics.removeActiveBody(projectileId);
      
      // Unregister collision callback if it was a grenade
      // this.physics.unregisterCollisionCallback(projectileId); // No longer needed for grenades
    }
    this.projectiles.delete(projectileId);
    this.previousPositions.delete(projectileId);
    this.recentCollisions.delete(projectileId);
  }
  
  // Get all projectiles
  getProjectiles(): ProjectileState[] {
    return Array.from(this.projectiles.values());
  }
  
  // Get projectile by ID
  getProjectile(projectileId: string): ProjectileState | undefined {
    return this.projectiles.get(projectileId);
  }
  
  // Clear all projectiles
  clear(): void {
    // Clean up Matter.js bodies
    for (const [projectileId, body] of this.projectileBodies) {
      this.physics.removeBody(body);
      this.physics.removeActiveBody(projectileId);
    }
    
    this.projectiles.clear();
    this.projectileBodies.clear();
    this.explosionQueue = [];
  }
} 