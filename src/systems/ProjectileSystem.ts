import { ProjectileState, PlayerState, Vector2, WallState, ExplosionEvent, PlayerDamageEvent, WallDamageEvent } from '../../shared/types';
import { GAME_CONFIG } from '../../shared/constants';
import { PhysicsSystem } from './PhysicsSystem';
import { WeaponSystem } from './WeaponSystem';
import Matter from 'matter-js';

export class ProjectileSystem {
  private projectiles: Map<string, ProjectileState> = new Map();
  private projectileBodies: Map<string, Matter.Body> = new Map();
  private physics: PhysicsSystem;
  private weaponSystem: WeaponSystem;
  private explosionQueue: ExplosionEvent[] = [];
  private previousPositions: Map<string, Vector2> = new Map();
  
  constructor(physics: PhysicsSystem, weaponSystem: WeaponSystem) {
    this.physics = physics;
    this.weaponSystem = weaponSystem;
    console.log('ProjectileSystem initialized');
  }
  
  // Create a new projectile
  createProjectile(
    type: 'bullet' | 'rocket' | 'grenade',
    position: Vector2,
    velocity: Vector2,
    ownerId: string,
    damage: number,
    options: {
      range?: number;
      explosionRadius?: number;
      chargeLevel?: number;
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
      chargeLevel: options.chargeLevel
    };
    
    // Debug: Log rocket creation
    if (type === 'rocket') {
      console.log(`🚀 ROCKET CREATED:`);
      console.log(`   ID: ${projectileId.substring(0, 8)}`);
      console.log(`   Position: (${position.x.toFixed(1)}, ${position.y.toFixed(1)})`);
      console.log(`   Velocity: (${velocity.x.toFixed(1)}, ${velocity.y.toFixed(1)}) = ${Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y).toFixed(1)} px/s`);
      console.log(`   Range: ${projectile.range}`);
    }
    
    this.projectiles.set(projectileId, projectile);
    
    // Create physics body for projectile
    if (type === 'grenade') { // Only grenades need physics for bouncing
      const body = this.createProjectileBody(projectile);
      this.projectileBodies.set(projectileId, body);
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
          2, // Small radius for grenade
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
  update(deltaTime: number, walls?: Map<string, WallState>): void {
    const projectilesToRemove: string[] = [];
    
    // Debug: Log walls once
    if (walls && Math.random() < 0.01) { // 1% chance
      console.log(`🧱 Walls available for collision: ${Array.from(walls.keys()).join(', ')}`);
    }
    
    projectileLoop: for (const [projectileId, projectile] of this.projectiles) {
      // Store previous position before updating
      this.previousPositions.set(projectileId, { ...projectile.position });
      
      const body = this.projectileBodies.get(projectileId);
      
      if (body) {
        // Update position from physics body
        projectile.position.x = body.position.x;
        projectile.position.y = body.position.y;
        projectile.velocity.x = body.velocity.x;
        projectile.velocity.y = body.velocity.y;
      } else {
        // For bullets without physics bodies, update position manually
        projectile.position.x += projectile.velocity.x * (deltaTime / 1000);
        projectile.position.y += projectile.velocity.y * (deltaTime / 1000);
      }
      
      // CRITICAL: Check wall collisions FIRST (before range/boundary checks)
      if (walls && projectile.type !== 'bullet') { // Bullets use hitscan
        // For fast projectiles, subdivide the path
        const steps = projectile.type === 'rocket' ? 5 : 1; // More steps for rockets
        const prevPos = this.previousPositions.get(projectile.id) || projectile.position;
        
        for (let step = 1; step <= steps; step++) {
          const t = step / steps;
          const checkPos = {
            x: prevPos.x + (projectile.position.x - prevPos.x) * t,
            y: prevPos.y + (projectile.position.y - prevPos.y) * t
          };
          
          // Check collision at this interpolated position
          const tempProjectile = { ...projectile, position: checkPos };
          const wallCollision = this.checkWallCollision(tempProjectile, walls);
          
          if (wallCollision.hit && wallCollision.wall) {
            console.log(`🚀 Projectile ${projectileId} hit wall ${wallCollision.wall.id} at step ${step}/${steps}!`);
            // Update projectile position to collision point
            projectile.position = checkPos;
            
            // Handle collision based on projectile type
            if (projectile.type === 'rocket') {
              this.explodeProjectile(projectile);
              projectilesToRemove.push(projectileId);
              continue projectileLoop; // Skip other checks
            } else if (projectile.type === 'grenade') {
              // Grenades bounce - handled elsewhere
            }
          }
        }
      }
      
      // Update traveled distance
      const speed = Math.sqrt(projectile.velocity.x * projectile.velocity.x + projectile.velocity.y * projectile.velocity.y);
      projectile.traveledDistance += speed * (deltaTime / 1000);
      
      // Debug: Log rocket position updates
      if (projectile.type === 'rocket' && Math.random() < 0.2) { // 20% sample rate
        console.log(`🚀 Rocket update: pos(${projectile.position.x.toFixed(1)}, ${projectile.position.y.toFixed(1)}) vel(${projectile.velocity.x.toFixed(1)}, ${projectile.velocity.y.toFixed(1)}) dist:${projectile.traveledDistance.toFixed(1)}/${projectile.range}`);
      }
      
      // Check if projectile has exceeded its range
      if (projectile.traveledDistance >= projectile.range) {
        if (projectile.type === 'grenade') {
          this.explodeProjectile(projectile);
        }
        projectilesToRemove.push(projectileId);
        continue;
      }
      
      // Check for grenade timer explosion
      if (projectile.type === 'grenade') {
        const fuseTime = 3000; // 3 seconds
        const timeAlive = Date.now() - projectile.timestamp;
        if (timeAlive >= fuseTime) {
          this.explodeProjectile(projectile);
          projectilesToRemove.push(projectileId);
          continue;
        }
      }
      
      // Check for boundary collisions
      if (this.checkBoundaryCollision(projectile)) {
        if (projectile.type === 'grenade') {
          // Grenades bounce off boundaries
          this.handleBoundaryBounce(projectile, body);
        } else {
          // Rockets explode on boundary hit
          if (projectile.type === 'rocket') {
            this.explodeProjectile(projectile);
          }
          projectilesToRemove.push(projectileId);
        }
      }
    }
    
    // Remove expired projectiles
    for (const projectileId of projectilesToRemove) {
      this.removeProjectile(projectileId);
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
  
  // Handle projectile bouncing off boundaries
  private handleBoundaryBounce(projectile: ProjectileState, body?: Matter.Body): void {
    // Clamp position to boundaries
    if (projectile.position.x < 0) {
      projectile.position.x = 0;
      projectile.velocity.x = -projectile.velocity.x * 0.7; // Reduce velocity on bounce
    }
    if (projectile.position.x > GAME_CONFIG.GAME_WIDTH) {
      projectile.position.x = GAME_CONFIG.GAME_WIDTH;
      projectile.velocity.x = -projectile.velocity.x * 0.7;
    }
    if (projectile.position.y < 0) {
      projectile.position.y = 0;
      projectile.velocity.y = -projectile.velocity.y * 0.7;
    }
    if (projectile.position.y > GAME_CONFIG.GAME_HEIGHT) {
      projectile.position.y = GAME_CONFIG.GAME_HEIGHT;
      projectile.velocity.y = -projectile.velocity.y * 0.7;
    }
    
    // Update physics body if it exists
    if (body) {
      Matter.Body.setPosition(body, projectile.position);
      Matter.Body.setVelocity(body, projectile.velocity);
    }
  }
  
  // Check collision with walls
  checkWallCollision(projectile: ProjectileState, walls: Map<string, WallState>): { hit: boolean; wall?: WallState; sliceIndex?: number } {
    // Get the stored previous position from before the update
    const previousPosition = this.previousPositions.get(projectile.id) || projectile.position;
    
    // Debug: Log rocket positions
    if (projectile.type === 'rocket') {
      console.log(`🚀 Rocket ${projectile.id.substring(0, 8)} checking collision:`);
      console.log(`   Previous: (${previousPosition.x.toFixed(1)}, ${previousPosition.y.toFixed(1)})`);
      console.log(`   Current:  (${projectile.position.x.toFixed(1)}, ${projectile.position.y.toFixed(1)})`);
      console.log(`   Distance: ${Math.sqrt(Math.pow(projectile.position.x - previousPosition.x, 2) + Math.pow(projectile.position.y - previousPosition.y, 2)).toFixed(1)}`);
    }
    
    for (const [wallId, wall] of walls) {
      // Check if projectile path intersects with wall
      const collision = this.checkLineWallCollision(previousPosition, projectile.position, wall);
      if (collision.hit) {
        // Debug: Log collision detection
        if (projectile.type === 'rocket') {
          console.log(`   💥 HIT WALL ${wallId} at slice ${collision.sliceIndex}`);
        }
        return {
          hit: true,
          wall,
          sliceIndex: collision.sliceIndex
        };
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
  private checkLineWallCollision(start: Vector2, end: Vector2, wall: WallState): { hit: boolean; sliceIndex?: number } {
    const wallLeft = wall.position.x;
    const wallRight = wall.position.x + wall.width;
    const wallTop = wall.position.y;
    const wallBottom = wall.position.y + wall.height;
    
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
      
      // Calculate which slice was hit
      const sliceWidth = wall.width / GAME_CONFIG.DESTRUCTION.WALL_SLICES;
      const sliceIndex = Math.floor((hitX - wall.position.x) / sliceWidth);
      
      return {
        hit: true,
        sliceIndex: Math.max(0, Math.min(GAME_CONFIG.DESTRUCTION.WALL_SLICES - 1, sliceIndex))
      };
    }
    
    return { hit: false };
  }
  
  // Check collision between projectile and wall
  private checkProjectileWallCollision(projectile: ProjectileState, wall: WallState): { hit: boolean; sliceIndex?: number } {
    const projectileSize = projectile.type === 'grenade' ? 2 : 1;
    
    // Check AABB collision
    if (
      projectile.position.x + projectileSize >= wall.position.x &&
      projectile.position.x - projectileSize <= wall.position.x + wall.width &&
      projectile.position.y + projectileSize >= wall.position.y &&
      projectile.position.y - projectileSize <= wall.position.y + wall.height
    ) {
      // Calculate which slice was hit
      const sliceWidth = wall.width / GAME_CONFIG.DESTRUCTION.WALL_SLICES;
      const sliceIndex = Math.floor((projectile.position.x - wall.position.x) / sliceWidth);
      
      return {
        hit: true,
        sliceIndex: Math.max(0, Math.min(GAME_CONFIG.DESTRUCTION.WALL_SLICES - 1, sliceIndex))
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
    const body = this.projectileBodies.get(projectile.id);
    
    // Simple bounce logic - reverse velocity component
    // TODO: Implement proper collision normal calculation
    if (projectile.position.x < wall.position.x || projectile.position.x > wall.position.x + wall.width) {
      projectile.velocity.x = -projectile.velocity.x * 0.6;
    }
    if (projectile.position.y < wall.position.y || projectile.position.y > wall.position.y + wall.height) {
      projectile.velocity.y = -projectile.velocity.y * 0.6;
    }
    
    // Update physics body
    if (body) {
      Matter.Body.setVelocity(body, projectile.velocity);
    }
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
  
  // Create explosion from projectile
  private explodeProjectile(projectile: ProjectileState): void {
    if (projectile.isExploded) return;
    
    projectile.isExploded = true;
    
    let explosionRadius = projectile.explosionRadius || 30;
    let explosionDamage = projectile.damage;
    
    // Apply charge level multiplier for grenades
    if (projectile.type === 'grenade' && projectile.chargeLevel) {
      const chargeMultiplier = 1 + ((projectile.chargeLevel - 1) * 0.3); // 30% increase per charge level
      explosionRadius *= chargeMultiplier;
      explosionDamage *= chargeMultiplier;
    }
    
    const explosion: ExplosionEvent = {
      position: { ...projectile.position },
      radius: explosionRadius,
      damage: explosionDamage,
      sourcePlayerId: projectile.ownerId,
      timestamp: Date.now()
    };
    
    this.explosionQueue.push(explosion);
  }
  
  // Process explosion damage
  processExplosions(players: Map<string, PlayerState>, walls: Map<string, WallState>): {
    playerDamageEvents: PlayerDamageEvent[];
    wallDamageEvents: WallDamageEvent[];
    explosions: ExplosionEvent[];
  } {
    const playerDamageEvents: PlayerDamageEvent[] = [];
    const wallDamageEvents: WallDamageEvent[] = [];
    const explosions: ExplosionEvent[] = [...this.explosionQueue];
    
    for (const explosion of this.explosionQueue) {
      // Damage players in explosion radius
      for (const [playerId, player] of players) {
        if (playerId === explosion.sourcePlayerId || !player.isAlive) continue;
        
        const distance = Math.sqrt(
          Math.pow(explosion.position.x - player.transform.position.x, 2) +
          Math.pow(explosion.position.y - player.transform.position.y, 2)
        );
        
        if (distance <= explosion.radius) {
          const damage = this.weaponSystem.calculateExplosionDamage(explosion.damage, distance, explosion.radius);
          
          if (damage > 0) {
            playerDamageEvents.push({
              playerId,
              damage,
              damageType: 'explosion',
              sourcePlayerId: explosion.sourcePlayerId,
              position: { ...explosion.position },
              newHealth: Math.max(0, player.health - damage),
              isKilled: player.health - damage <= 0,
              timestamp: Date.now()
            });
          }
        }
      }
      
      // Damage walls in explosion radius
      for (const [wallId, wall] of walls) {
        const distance = Math.sqrt(
          Math.pow(explosion.position.x - (wall.position.x + wall.width / 2), 2) +
          Math.pow(explosion.position.y - (wall.position.y + wall.height / 2), 2)
        );
        
        if (distance <= explosion.radius) {
          const damage = this.weaponSystem.calculateExplosionDamage(explosion.damage, distance, explosion.radius);
          
          if (damage > 0) {
            // Calculate which slice is closest to the explosion
            const sliceWidth = wall.width / GAME_CONFIG.DESTRUCTION.WALL_SLICES;
            const explosionRelativeX = explosion.position.x - wall.position.x;
            const closestSlice = Math.floor(explosionRelativeX / sliceWidth);
            const centerSlice = Math.max(0, Math.min(GAME_CONFIG.DESTRUCTION.WALL_SLICES - 1, closestSlice));
            
            // Damage multiple slices based on explosion radius
            const slicesAffected = Math.ceil(explosion.radius / sliceWidth);
            
            for (let i = 0; i < slicesAffected; i++) {
              const sliceIndex = Math.max(0, Math.min(GAME_CONFIG.DESTRUCTION.WALL_SLICES - 1, centerSlice + i - Math.floor(slicesAffected / 2)));
              
              wallDamageEvents.push(this.createWallDamageEvent(wall, sliceIndex, explosion.position, damage));
            }
          }
        }
      }
    }
    
    // Clear explosion queue
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
    }
    this.projectiles.delete(projectileId);
    this.previousPositions.delete(projectileId);
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
    // Remove all physics bodies
    for (const body of this.projectileBodies.values()) {
      this.physics.removeBody(body);
    }
    
    this.projectiles.clear();
    this.projectileBodies.clear();
    this.explosionQueue = [];
  }
} 