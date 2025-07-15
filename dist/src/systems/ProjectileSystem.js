"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectileSystem = void 0;
const constants_1 = require("../../shared/constants");
const matter_js_1 = __importDefault(require("matter-js"));
class ProjectileSystem {
    projectiles = new Map();
    projectileBodies = new Map();
    physics;
    weaponSystem;
    explosionQueue = [];
    constructor(physics, weaponSystem) {
        this.physics = physics;
        this.weaponSystem = weaponSystem;
        console.log('ProjectileSystem initialized');
    }
    // Create a new projectile
    createProjectile(type, position, velocity, ownerId, damage, options = {}) {
        const projectileId = this.weaponSystem.generateProjectileId();
        const projectile = {
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
    createProjectileBody(projectile) {
        let body;
        switch (projectile.type) {
            case 'grenade':
                body = matter_js_1.default.Bodies.circle(projectile.position.x, projectile.position.y, 2, // Small radius for grenade
                {
                    friction: 0.3,
                    frictionAir: 0.01,
                    restitution: 0.6, // Bouncy
                    label: `grenade:${projectile.id}`,
                    render: { visible: false }
                });
                break;
            case 'rocket':
                body = matter_js_1.default.Bodies.rectangle(projectile.position.x, projectile.position.y, 6, 2, // Rocket dimensions
                {
                    friction: 0.1,
                    frictionAir: 0.05,
                    restitution: 0.1,
                    label: `rocket:${projectile.id}`,
                    render: { visible: false }
                });
                break;
            default:
                body = matter_js_1.default.Bodies.circle(projectile.position.x, projectile.position.y, 1, {
                    friction: 0.1,
                    frictionAir: 0.01,
                    restitution: 0.1,
                    label: `projectile:${projectile.id}`,
                    render: { visible: false }
                });
        }
        // Set initial velocity
        matter_js_1.default.Body.setVelocity(body, projectile.velocity);
        // Add to physics world
        this.physics.addBody(body);
        return body;
    }
    // Update all projectiles
    update(deltaTime) {
        const projectilesToRemove = [];
        for (const [projectileId, projectile] of this.projectiles) {
            const body = this.projectileBodies.get(projectileId);
            if (body) {
                // Update position from physics body
                projectile.position.x = body.position.x;
                projectile.position.y = body.position.y;
                projectile.velocity.x = body.velocity.x;
                projectile.velocity.y = body.velocity.y;
            }
            else {
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
                }
                else {
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
    checkBoundaryCollision(projectile) {
        return (projectile.position.x < 0 ||
            projectile.position.x > constants_1.GAME_CONFIG.GAME_WIDTH ||
            projectile.position.y < 0 ||
            projectile.position.y > constants_1.GAME_CONFIG.GAME_HEIGHT);
    }
    // Handle projectile bouncing off boundaries
    handleBoundaryBounce(projectile, body) {
        // Clamp position to boundaries
        if (projectile.position.x < 0) {
            projectile.position.x = 0;
            projectile.velocity.x = -projectile.velocity.x * 0.7; // Reduce velocity on bounce
        }
        if (projectile.position.x > constants_1.GAME_CONFIG.GAME_WIDTH) {
            projectile.position.x = constants_1.GAME_CONFIG.GAME_WIDTH;
            projectile.velocity.x = -projectile.velocity.x * 0.7;
        }
        if (projectile.position.y < 0) {
            projectile.position.y = 0;
            projectile.velocity.y = -projectile.velocity.y * 0.7;
        }
        if (projectile.position.y > constants_1.GAME_CONFIG.GAME_HEIGHT) {
            projectile.position.y = constants_1.GAME_CONFIG.GAME_HEIGHT;
            projectile.velocity.y = -projectile.velocity.y * 0.7;
        }
        // Update physics body if it exists
        if (body) {
            matter_js_1.default.Body.setPosition(body, projectile.position);
            matter_js_1.default.Body.setVelocity(body, projectile.velocity);
        }
    }
    // Check collision with walls
    checkWallCollision(projectile, walls) {
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
    checkPlayerCollision(projectile, players) {
        for (const [playerId, player] of players) {
            if (playerId === projectile.ownerId || !player.isAlive)
                continue;
            const distance = Math.sqrt(Math.pow(projectile.position.x - player.transform.position.x, 2) +
                Math.pow(projectile.position.y - player.transform.position.y, 2));
            if (distance <= constants_1.GAME_CONFIG.PLAYER_SIZE / 2) {
                return { hit: true, player };
            }
        }
        return { hit: false };
    }
    // Check if a line segment intersects with a wall
    checkLineWallCollision(start, end, wall) {
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
            const sliceWidth = wall.width / constants_1.GAME_CONFIG.DESTRUCTION.WALL_SLICES;
            const sliceIndex = Math.floor((end.x - wall.position.x) / sliceWidth);
            return {
                hit: true,
                sliceIndex: Math.max(0, Math.min(constants_1.GAME_CONFIG.DESTRUCTION.WALL_SLICES - 1, sliceIndex))
            };
        }
        return { hit: false };
    }
    // Check collision between projectile and wall
    checkProjectileWallCollision(projectile, wall) {
        const projectileSize = projectile.type === 'grenade' ? 2 : 1;
        // Check AABB collision
        if (projectile.position.x + projectileSize >= wall.position.x &&
            projectile.position.x - projectileSize <= wall.position.x + wall.width &&
            projectile.position.y + projectileSize >= wall.position.y &&
            projectile.position.y - projectileSize <= wall.position.y + wall.height) {
            // Calculate which slice was hit
            const sliceWidth = wall.width / constants_1.GAME_CONFIG.DESTRUCTION.WALL_SLICES;
            const sliceIndex = Math.floor((projectile.position.x - wall.position.x) / sliceWidth);
            return {
                hit: true,
                sliceIndex: Math.max(0, Math.min(constants_1.GAME_CONFIG.DESTRUCTION.WALL_SLICES - 1, sliceIndex))
            };
        }
        return { hit: false };
    }
    // Handle projectile collision with wall
    handleWallCollision(projectile, wall, sliceIndex) {
        if (projectile.type === 'grenade') {
            // Grenades bounce off walls
            this.handleWallBounce(projectile, wall);
            return null;
        }
        else if (projectile.type === 'rocket') {
            // Rockets explode on wall hit
            this.explodeProjectile(projectile);
            return this.createWallDamageEvent(wall, sliceIndex, projectile.position, projectile.damage);
        }
        return null;
    }
    // Handle projectile bouncing off wall
    handleWallBounce(projectile, wall) {
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
            matter_js_1.default.Body.setVelocity(body, projectile.velocity);
        }
    }
    // Handle projectile collision with player
    handlePlayerCollision(projectile, player) {
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
    explodeProjectile(projectile) {
        if (projectile.isExploded)
            return;
        projectile.isExploded = true;
        let explosionRadius = projectile.explosionRadius || 30;
        let explosionDamage = projectile.damage;
        // Apply charge level multiplier for grenades
        if (projectile.type === 'grenade' && projectile.chargeLevel) {
            const chargeMultiplier = 1 + ((projectile.chargeLevel - 1) * 0.3); // 30% increase per charge level
            explosionRadius *= chargeMultiplier;
            explosionDamage *= chargeMultiplier;
        }
        const explosion = {
            position: { ...projectile.position },
            radius: explosionRadius,
            damage: explosionDamage,
            sourcePlayerId: projectile.ownerId,
            timestamp: Date.now()
        };
        this.explosionQueue.push(explosion);
    }
    // Process explosion damage
    processExplosions(players, walls) {
        const playerDamageEvents = [];
        const wallDamageEvents = [];
        const explosions = [...this.explosionQueue];
        for (const explosion of this.explosionQueue) {
            // Damage players in explosion radius
            for (const [playerId, player] of players) {
                if (playerId === explosion.sourcePlayerId || !player.isAlive)
                    continue;
                const distance = Math.sqrt(Math.pow(explosion.position.x - player.transform.position.x, 2) +
                    Math.pow(explosion.position.y - player.transform.position.y, 2));
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
                const distance = Math.sqrt(Math.pow(explosion.position.x - (wall.position.x + wall.width / 2), 2) +
                    Math.pow(explosion.position.y - (wall.position.y + wall.height / 2), 2));
                if (distance <= explosion.radius) {
                    const damage = this.weaponSystem.calculateExplosionDamage(explosion.damage, distance, explosion.radius);
                    if (damage > 0) {
                        // Calculate which slice is closest to the explosion
                        const sliceWidth = wall.width / constants_1.GAME_CONFIG.DESTRUCTION.WALL_SLICES;
                        const explosionRelativeX = explosion.position.x - wall.position.x;
                        const closestSlice = Math.floor(explosionRelativeX / sliceWidth);
                        const centerSlice = Math.max(0, Math.min(constants_1.GAME_CONFIG.DESTRUCTION.WALL_SLICES - 1, closestSlice));
                        // Damage multiple slices based on explosion radius
                        const slicesAffected = Math.ceil(explosion.radius / sliceWidth);
                        for (let i = 0; i < slicesAffected; i++) {
                            const sliceIndex = Math.max(0, Math.min(constants_1.GAME_CONFIG.DESTRUCTION.WALL_SLICES - 1, centerSlice + i - Math.floor(slicesAffected / 2)));
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
    createWallDamageEvent(wall, sliceIndex, position, damage) {
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
    removeProjectile(projectileId) {
        const body = this.projectileBodies.get(projectileId);
        if (body) {
            this.physics.removeBody(body);
            this.projectileBodies.delete(projectileId);
        }
        this.projectiles.delete(projectileId);
    }
    // Get all projectiles
    getProjectiles() {
        return Array.from(this.projectiles.values());
    }
    // Get projectile by ID
    getProjectile(projectileId) {
        return this.projectiles.get(projectileId);
    }
    // Clear all projectiles
    clear() {
        // Remove all physics bodies
        for (const body of this.projectileBodies.values()) {
            this.physics.removeBody(body);
        }
        this.projectiles.clear();
        this.projectileBodies.clear();
        this.explosionQueue = [];
    }
}
exports.ProjectileSystem = ProjectileSystem;
