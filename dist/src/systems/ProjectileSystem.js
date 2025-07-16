"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectileSystem = void 0;
const constants_1 = require("../../shared/constants");
const matter_js_1 = __importDefault(require("matter-js"));
const wallSliceHelpers_1 = require("../utils/wallSliceHelpers");
class ProjectileSystem {
    projectiles;
    physics;
    weaponSystem;
    destructionSystem;
    projectileBodies;
    previousPositions;
    recentCollisions; // projectileId -> wallId -> timestamp
    explosionQueue = [];
    // Grenade physics constants
    GRENADE_RADIUS = 2;
    GRENADE_GROUND_FRICTION = 0.85; // per second - increased from 0.95 for faster slowdown
    GRENADE_BOUNCE_DAMPING = 0.7; // energy retained after bounce
    GRENADE_WALL_FRICTION = 0.85; // tangential velocity retained
    GRENADE_MIN_BOUNCE_SPEED = 10; // minimum speed to bounce
    GRENADE_COLLISION_COOLDOWN = 200; // ms between collisions with same wall
    GRENADE_SEPARATION_DISTANCE = 3; // extra pixels from wall
    GRENADE_VELOCITY_THRESHOLD = 5; // speed below which we apply heavy damping
    constructor(physics, weaponSystem, destructionSystem) {
        this.projectiles = new Map();
        this.physics = physics;
        this.weaponSystem = weaponSystem;
        this.destructionSystem = destructionSystem;
        this.projectileBodies = new Map();
        this.previousPositions = new Map();
        this.recentCollisions = new Map();
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
        this.recentCollisions.set(projectileId, new Map());
        // Only create physics bodies for non-grenade projectiles
        // Grenades use manual physics for predictable behavior
        if (type === 'rocket') {
            const body = this.createProjectileBody(projectile);
            this.projectileBodies.set(projectileId, body);
            this.physics.addActiveBody(projectileId);
        }
        return projectile;
    }
    // Create physics body for projectile
    createProjectileBody(projectile) {
        let body;
        switch (projectile.type) {
            case 'grenade':
                body = matter_js_1.default.Bodies.circle(projectile.position.x, projectile.position.y, this.GRENADE_RADIUS, {
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
    update(deltaTime, walls) {
        const updateEvents = [];
        const explodeEvents = [];
        const projectilesToRemove = [];
        projectileLoop: for (const [projectileId, projectile] of this.projectiles) {
            // Store previous position before updating
            this.previousPositions.set(projectileId, { ...projectile.position });
            // Get physics body if it exists (only for rockets now)
            const body = this.projectileBodies.get(projectileId);
            // Update position based on projectile type
            if (projectile.type === 'grenade') {
                // Manual physics for grenades
                this.updateGrenade(projectile, deltaTime, walls);
            }
            else if (body) {
                // Sync position from Matter.js physics body (rockets)
                projectile.position.x = body.position.x;
                projectile.position.y = body.position.y;
                projectile.velocity.x = body.velocity.x;
                projectile.velocity.y = body.velocity.y;
            }
            else {
                // Manual position update for bullets and other projectiles
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
            // Check for grenade timer explosion
            if (projectile.type === 'grenade') {
                const fuseTime = 3000; // 3 seconds
                const timeAlive = Date.now() - projectile.timestamp;
                if (timeAlive >= fuseTime) {
                    this.explodeProjectile(projectile);
                    explodeEvents.push({
                        id: projectile.id,
                        position: { x: projectile.position.x, y: projectile.position.y },
                        radius: projectile.explosionRadius || 40
                    });
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
                    this.explodeProjectile(projectile);
                    explodeEvents.push({
                        id: projectile.id,
                        position: { x: projectile.position.x, y: projectile.position.y },
                        radius: projectile.explosionRadius || 50
                    });
                    projectilesToRemove.push(projectileId);
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
        }
        // Remove expired projectiles
        for (const projectileId of projectilesToRemove) {
            this.removeProjectile(projectileId);
        }
        return { updateEvents, explodeEvents };
    }
    // Manual physics update for grenades
    updateGrenade(grenade, deltaTime, walls) {
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
        }
        else {
            // No collision, update position
            grenade.position.x = newX;
            grenade.position.y = newY;
        }
        // Handle boundary collisions
        this.handleGrenadeBoundaryCollision(grenade);
    }
    // Check grenade movement for collisions
    checkGrenadeMovement(from, to, walls) {
        if (!walls)
            return null;
        // Calculate movement vector
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < 0.001)
            return null; // Not moving
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
    handleGrenadeCollision(grenade, collision) {
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
    handleGrenadeBoundaryCollision(grenade) {
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
        if (grenade.position.x + this.GRENADE_RADIUS >= constants_1.GAME_CONFIG.GAME_WIDTH) {
            grenade.position.x = constants_1.GAME_CONFIG.GAME_WIDTH - this.GRENADE_RADIUS;
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
        if (grenade.position.y + this.GRENADE_RADIUS >= constants_1.GAME_CONFIG.GAME_HEIGHT) {
            grenade.position.y = constants_1.GAME_CONFIG.GAME_HEIGHT - this.GRENADE_RADIUS;
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
    checkBoundaryCollision(projectile) {
        return (projectile.position.x < 0 ||
            projectile.position.x > constants_1.GAME_CONFIG.GAME_WIDTH ||
            projectile.position.y < 0 ||
            projectile.position.y > constants_1.GAME_CONFIG.GAME_HEIGHT);
    }
    // Check collision with walls
    checkWallCollision(projectile, walls) {
        // Get the stored previous position from before the update
        const previousPosition = this.previousPositions.get(projectile.id) || projectile.position;
        // Debug: Log rocket positions
        if (projectile.type === 'rocket') {
            // console.log(`🚀 Rocket ${projectile.id.substring(0, 8)} checking collision:`);
            // console.log(`   Previous: (${previousPosition.x.toFixed(1)}, ${previousPosition.y.toFixed(1)})`);
            // console.log(`   Current:  (${projectile.position.x.toFixed(1)}, ${projectile.position.y.toFixed(1)})`);
            // console.log(`   Distance: ${Math.sqrt(Math.pow(projectile.position.x - previousPosition.x, 2) + Math.pow(projectile.position.y - previousPosition.y, 2)).toFixed(1)}`);
        }
        for (const [wallId, wall] of walls) {
            // Check if projectile path intersects with wall
            // Pass grenade radius for proper edge collision detection
            const projectileRadius = projectile.type === 'grenade' ? this.GRENADE_RADIUS : 0;
            const collision = this.checkLineWallCollision(previousPosition, projectile.position, wall, projectileRadius);
            if (collision.hit) {
                // Debug: Log collision detection
                if (projectile.type === 'rocket') {
                    // console.log(`   💥 HIT WALL ${wallId} at slice ${collision.sliceIndex}`);
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
    checkLineWallCollision(start, end, wall, projectileRadius = 0) {
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
        }
        else {
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
        }
        else {
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
            const sliceIndex = (0, wallSliceHelpers_1.calculateSliceIndex)(wall, { x: hitX, y: hitY });
            return {
                hit: true,
                sliceIndex: sliceIndex
            };
        }
        return { hit: false };
    }
    // Check collision between projectile and wall
    checkProjectileWallCollision(projectile, wall) {
        const projectileSize = projectile.type === 'grenade' ? this.GRENADE_RADIUS : 1;
        // Check AABB collision
        if (projectile.position.x + projectileSize >= wall.position.x &&
            projectile.position.x - projectileSize <= wall.position.x + wall.width &&
            projectile.position.y + projectileSize >= wall.position.y &&
            projectile.position.y - projectileSize <= wall.position.y + wall.height) {
            // Calculate which slice was hit
            const sliceIndex = (0, wallSliceHelpers_1.calculateSliceIndex)(wall, projectile.position);
            return {
                hit: true,
                sliceIndex: sliceIndex
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
        }
        else {
            // Grenade is exactly on wall edge/corner - use velocity to determine normal
            const speed = Math.sqrt(projectile.velocity.x ** 2 + projectile.velocity.y ** 2);
            if (speed > 0) {
                normalX = -projectile.velocity.x / speed;
                normalY = -projectile.velocity.y / speed;
            }
            else {
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
            }
            else if (minDist === distRight) {
                projectile.position.x = wallRight + grenadeRadius + 3;
            }
            else if (minDist === distTop) {
                projectile.position.y = wallTop - grenadeRadius - 3;
            }
            else {
                projectile.position.y = wallBottom + grenadeRadius + 3;
            }
        }
        // Ensure we're within game bounds
        projectile.position.x = Math.max(grenadeRadius, Math.min(constants_1.GAME_CONFIG.GAME_WIDTH - grenadeRadius, projectile.position.x));
        projectile.position.y = Math.max(grenadeRadius, Math.min(constants_1.GAME_CONFIG.GAME_HEIGHT - grenadeRadius, projectile.position.y));
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
    // Mark projectile for explosion
    explodeProjectile(projectile) {
        if (projectile.isExploded)
            return;
        projectile.isExploded = true;
        const explosion = {
            position: { x: projectile.position.x, y: projectile.position.y },
            radius: projectile.explosionRadius || 50,
            damage: projectile.damage,
            sourcePlayerId: projectile.ownerId,
            timestamp: Date.now()
        };
        this.explosionQueue.push(explosion);
    }
    // Get distance from point to wall
    getDistanceToWall(point, wall) {
        // Calculate distance to closest point on wall
        const closestX = Math.max(wall.position.x, Math.min(point.x, wall.position.x + wall.width));
        const closestY = Math.max(wall.position.y, Math.min(point.y, wall.position.y + wall.height));
        return Math.sqrt(Math.pow(point.x - closestX, 2) +
            Math.pow(point.y - closestY, 2));
    }
    // Process explosions and return damage events
    processExplosions(players, walls) {
        const playerDamageEvents = [];
        const wallDamageEvents = [];
        const explosions = [...this.explosionQueue];
        for (const explosion of this.explosionQueue) {
            // Add null check for explosion
            if (!explosion || !explosion.position) {
                console.error('Invalid explosion in queue:', explosion);
                continue;
            }
            // Damage players in explosion radius
            for (const [playerId, player] of players) {
                if (!player || !player.isAlive || !player.position)
                    continue;
                const distance = Math.sqrt(Math.pow(player.position.x - explosion.position.x, 2) +
                    Math.pow(player.position.y - explosion.position.y, 2));
                if (distance <= explosion.radius) {
                    const damageMultiplier = 1 - (distance / explosion.radius);
                    const damage = Math.floor(explosion.damage * damageMultiplier);
                    playerDamageEvents.push({
                        playerId,
                        damage,
                        damageType: 'explosion',
                        sourcePlayerId: explosion.sourcePlayerId,
                        position: { ...player.position },
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
                    const sliceWidth = wall.width / constants_1.GAME_CONFIG.DESTRUCTION.WALL_SLICES;
                    const affectedSlices = [];
                    for (let i = 0; i < constants_1.GAME_CONFIG.DESTRUCTION.WALL_SLICES; i++) {
                        const sliceCenterX = wall.position.x + (i + 0.5) * sliceWidth;
                        const sliceCenterY = wall.position.y + wall.height / 2;
                        const sliceDistance = Math.sqrt(Math.pow(sliceCenterX - explosion.position.x, 2) +
                            Math.pow(sliceCenterY - explosion.position.y, 2));
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
    getProjectiles() {
        return Array.from(this.projectiles.values());
    }
    // Get projectile by ID
    getProjectile(projectileId) {
        return this.projectiles.get(projectileId);
    }
    // Clear all projectiles
    clear() {
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
exports.ProjectileSystem = ProjectileSystem;
