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
    
    this.projectiles.set(projectileId, projectile);
    
    // Create physics body for projectile
    if (type !== 'bullet') { // Bullets use hitscan, don't need physics bodies
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
  update(deltaTime: number): void {
    const projectilesToRemove: string[] = [];
    
    for (const [projectileId, projectile] of this.projectiles) {
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
      
      // Update traveled distance
      const speed = Math.sqrt(projectile.velocity.x * projectile.velocity.x + projectile.velocity.y * projectile.velocity.y);
      projectile.traveledDistance += speed * (deltaTime / 1000);
      
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
    // For fast-moving projectiles, check the line segment from previous to current position
    const previousPosition = {
      x: projectile.position.x - projectile.velocity.x * 0.016, // Assume 60Hz update
      y: projectile.position.y - projectile.velocity.y * 0.016
    };
    
    for (const [wallId, wall] of walls) {
      // Check if projectile path intersects with wall
      const collision = this.checkLineWallCollision(previousPosition, projectile.position, wall);
      if (collision.hit) {
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
    // Simple AABB line intersection for now
    const wallLeft = wall.position.x;
    const wallRight = wall.position.x + wall.width;
    const wallTop = wall.position.y;
    const wallBottom = wall.position.y + wall.height;
    
    // Check if line crosses wall boundaries
    if ((start.x < wallLeft && end.x < wallLeft) || (start.x > wallRight && end.x > wallRight) ||
        (start.y < wallTop && end.y < wallTop) || (start.y > wallBottom && end.y > wallBottom)) {
      return { hit: false };
    }
    
    // If we get here, there might be an intersection
    // For now, use simple endpoint check (can be improved with proper line-AABB intersection)
    if (end.x >= wallLeft && end.x <= wallRight && end.y >= wallTop && end.y <= wallBottom) {
      const sliceWidth = wall.width / GAME_CONFIG.DESTRUCTION.WALL_SLICES;
      const sliceIndex = Math.floor((end.x - wall.position.x) / sliceWidth);
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