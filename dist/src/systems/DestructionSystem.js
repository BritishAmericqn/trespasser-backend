"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DestructionSystem = void 0;
const constants_1 = require("../../shared/constants");
const matter_js_1 = __importDefault(require("matter-js"));
const wallSliceHelpers_1 = require("../utils/wallSliceHelpers");
const MapLoader_1 = require("../utils/MapLoader");
class DestructionSystem {
    physics;
    walls = new Map();
    wallBodies = new Map();
    wallIdCounter = 0;
    spawnPositions = [];
    constructor(physics) {
        this.physics = physics;
        // Don't initialize in constructor - will be called separately
    }
    // Initialize walls - must be called after construction
    async initialize() {
        await this.initializeWalls();
    }
    // Initialize walls - either from map file or test walls
    async initializeWalls() {
        // Check if we should load a map file
        const mapFile = process.env.MAP_FILE || process.env.LOAD_MAP;
        if (mapFile) {
            try {
                const mapLoader = new MapLoader_1.MapLoader(this);
                await mapLoader.loadMapFromFile(mapFile);
                // Store spawn positions from the map
                this.spawnPositions = mapLoader.getSpawnPositions();
            }
            catch (error) {
                console.error(`Failed to load map file, falling back to test walls:`, error);
                this.initializeTestWalls();
            }
        }
        else {
            console.log('📍 No map file specified, using test walls');
            this.initializeTestWalls();
        }
    }
    // Initialize test walls for development
    initializeTestWalls() {
        // Mix of horizontal and vertical walls for testing
        // Horizontal walls (width > height)
        this.createWall({
            position: { x: 200, y: 100 },
            width: 60,
            height: 15,
            material: 'concrete'
        });
        // Vertical wall (height > width)
        this.createWall({
            position: { x: 100, y: 150 },
            width: 15,
            height: 60,
            material: 'wood'
        });
        // Horizontal wall
        this.createWall({
            position: { x: 300, y: 150 },
            width: 60,
            height: 15,
            material: 'metal'
        });
        // Vertical wall
        this.createWall({
            position: { x: 150, y: 30 },
            width: 15,
            height: 75,
            material: 'glass'
        });
        // Additional mixed walls for testing
        // Vertical wall
        this.createWall({
            position: { x: 320, y: 50 },
            width: 15,
            height: 60,
            material: 'concrete'
        });
        // Horizontal wall
        this.createWall({
            position: { x: 280, y: 120 },
            width: 90,
            height: 15,
            material: 'wood'
        });
        // Vertical wall
        this.createWall({
            position: { x: 380, y: 100 },
            width: 15,
            height: 45,
            material: 'metal'
        });
        // Horizontal wall
        this.createWall({
            position: { x: 250, y: 180 },
            width: 75,
            height: 15,
            material: 'glass'
        });
        // Create boundary walls for physics collisions
        // Top boundary (horizontal)
        this.createWall({
            position: { x: 0, y: -10 },
            width: constants_1.GAME_CONFIG.GAME_WIDTH,
            height: 10,
            material: 'concrete'
        });
        // Bottom boundary (horizontal)
        this.createWall({
            position: { x: 0, y: constants_1.GAME_CONFIG.GAME_HEIGHT },
            width: constants_1.GAME_CONFIG.GAME_WIDTH,
            height: 10,
            material: 'concrete'
        });
        // Left boundary (vertical)
        this.createWall({
            position: { x: -10, y: 0 },
            width: 10,
            height: constants_1.GAME_CONFIG.GAME_HEIGHT,
            material: 'concrete'
        });
        // Right boundary (vertical)
        this.createWall({
            position: { x: constants_1.GAME_CONFIG.GAME_WIDTH, y: 0 },
            width: 10,
            height: constants_1.GAME_CONFIG.GAME_HEIGHT,
            material: 'concrete'
        });
        // console.log(`🧱 Initialized ${this.walls.size} walls (including boundaries)`);
    }
    // Create a new wall
    createWall(params) {
        const wallId = `wall_${++this.wallIdCounter}`;
        // Determine orientation based on dimensions
        const orientation = (0, wallSliceHelpers_1.determineWallOrientation)(params.width, params.height);
        // Calculate slice health based on material
        const materialMultiplier = constants_1.GAME_CONFIG.DESTRUCTION.MATERIAL_MULTIPLIERS[params.material.toUpperCase()];
        const sliceHealth = constants_1.GAME_CONFIG.DESTRUCTION.SLICE_HEALTH * materialMultiplier;
        const wall = {
            id: wallId,
            position: { ...params.position },
            width: params.width,
            height: params.height,
            orientation: orientation, // Set orientation based on dimensions
            destructionMask: new Uint8Array(constants_1.GAME_CONFIG.DESTRUCTION.WALL_SLICES),
            material: params.material,
            maxHealth: sliceHealth,
            sliceHealth: Array(constants_1.GAME_CONFIG.DESTRUCTION.WALL_SLICES).fill(sliceHealth)
        };
        // Initialize destruction mask (0 = intact, 1 = destroyed)
        wall.destructionMask.fill(0);
        this.walls.set(wallId, wall);
        // Create physics body for the wall if physics system is available
        if (this.physics) {
            const body = matter_js_1.default.Bodies.rectangle(params.position.x + params.width / 2, params.position.y + params.height / 2, params.width, params.height, {
                isStatic: true,
                friction: 0.8,
                restitution: 0.5,
                label: `wall:${wallId}`,
                render: { visible: false }
            });
            this.physics.addBody(body);
            this.wallBodies.set(wallId, body);
            // console.log(`🧱 Created physics body for wall ${wallId}`);
        }
        return wall;
    }
    // Apply damage to a wall slice
    applyDamage(wallId, sliceIndex, damage) {
        const wall = this.walls.get(wallId);
        if (!wall) {
            return null;
        }
        // Validate slice index
        if (sliceIndex < 0 || sliceIndex >= constants_1.GAME_CONFIG.DESTRUCTION.WALL_SLICES) {
            return null;
        }
        // Check if slice is already destroyed
        if (wall.destructionMask[sliceIndex] === 1) {
            return null;
        }
        // Apply damage
        const currentHealth = wall.sliceHealth[sliceIndex];
        const newHealth = Math.max(0, currentHealth - damage);
        wall.sliceHealth[sliceIndex] = newHealth;
        // Check if slice is destroyed
        const isDestroyed = newHealth <= 0;
        // Update bitmask based on health-based visibility logic
        // For soft walls: transparent at 50% health, for hard walls: only when fully destroyed
        const shouldAllowVision = (0, wallSliceHelpers_1.shouldSliceAllowVision)(wall.material, newHealth, wall.maxHealth);
        wall.destructionMask[sliceIndex] = shouldAllowVision ? 1 : 0;
        return {
            wallId,
            position: this.getSlicePosition(wall, sliceIndex),
            damage,
            sliceIndex,
            newHealth,
            isDestroyed,
            timestamp: Date.now()
        };
    }
    // Get the position of a specific slice
    getSlicePosition(wall, sliceIndex) {
        return (0, wallSliceHelpers_1.getSlicePosition)(wall, sliceIndex);
    }
    // Check if a wall slice is destroyed
    isSliceDestroyed(wallId, sliceIndex) {
        const wall = this.walls.get(wallId);
        if (!wall || sliceIndex < 0 || sliceIndex >= constants_1.GAME_CONFIG.DESTRUCTION.WALL_SLICES) {
            return false;
        }
        return wall.destructionMask[sliceIndex] === 1;
    }
    // Check if entire wall is destroyed
    isWallDestroyed(wallId) {
        const wall = this.walls.get(wallId);
        if (!wall)
            return false;
        // Wall is destroyed if all slices are destroyed
        for (let i = 0; i < constants_1.GAME_CONFIG.DESTRUCTION.WALL_SLICES; i++) {
            if (wall.destructionMask[i] === 0) {
                return false;
            }
        }
        return true;
    }
    // Get wall health percentage
    getWallHealth(wallId) {
        const wall = this.walls.get(wallId);
        if (!wall)
            return 0;
        const totalHealth = wall.sliceHealth.reduce((sum, health) => sum + health, 0);
        const maxTotalHealth = wall.maxHealth * constants_1.GAME_CONFIG.DESTRUCTION.WALL_SLICES;
        return totalHealth / maxTotalHealth;
    }
    // Get slice health percentage
    getSliceHealth(wallId, sliceIndex) {
        const wall = this.walls.get(wallId);
        if (!wall || sliceIndex < 0 || sliceIndex >= constants_1.GAME_CONFIG.DESTRUCTION.WALL_SLICES) {
            return 0;
        }
        return wall.sliceHealth[sliceIndex] / wall.maxHealth;
    }
    // Remove a wall completely
    removeWall(wallId) {
        // Remove physics body if it exists
        if (this.physics) {
            const body = this.wallBodies.get(wallId);
            if (body) {
                this.physics.removeBody(body);
                this.wallBodies.delete(wallId);
            }
        }
        return this.walls.delete(wallId);
    }
    // Get all walls
    getWalls() {
        return this.walls;
    }
    // Get wall by ID
    getWall(wallId) {
        return this.walls.get(wallId);
    }
    // Check if a point is inside a wall slice
    isPointInWallSlice(position, wallId, sliceIndex) {
        const wall = this.walls.get(wallId);
        if (!wall || sliceIndex < 0 || sliceIndex >= constants_1.GAME_CONFIG.DESTRUCTION.WALL_SLICES) {
            return false;
        }
        // Check if slice is destroyed
        if (wall.destructionMask[sliceIndex] === 1) {
            return false;
        }
        return (0, wallSliceHelpers_1.isPointInSlice)(wall, position, sliceIndex);
    }
    // Check if a point is inside any wall slice
    isPointInAnyWall(position) {
        for (const [wallId, wall] of this.walls) {
            // Quick AABB check first
            if (position.x >= wall.position.x &&
                position.x <= wall.position.x + wall.width &&
                position.y >= wall.position.y &&
                position.y <= wall.position.y + wall.height) {
                // Check each slice
                for (let sliceIndex = 0; sliceIndex < constants_1.GAME_CONFIG.DESTRUCTION.WALL_SLICES; sliceIndex++) {
                    if (this.isPointInWallSlice(position, wallId, sliceIndex)) {
                        return { hit: true, wall, sliceIndex };
                    }
                }
            }
        }
        return { hit: false };
    }
    // Get walls within a radius of a point
    getWallsInRadius(position, radius) {
        const wallsInRadius = [];
        for (const wall of this.walls.values()) {
            // Calculate distance from point to wall center
            const wallCenter = {
                x: wall.position.x + wall.width / 2,
                y: wall.position.y + wall.height / 2
            };
            const distance = Math.sqrt(Math.pow(position.x - wallCenter.x, 2) +
                Math.pow(position.y - wallCenter.y, 2));
            if (distance <= radius) {
                wallsInRadius.push(wall);
            }
        }
        return wallsInRadius;
    }
    // Apply explosion damage to walls in radius
    applyExplosionDamage(position, radius, damage) {
        const damageEvents = [];
        const wallsInRadius = this.getWallsInRadius(position, radius);
        for (const wall of wallsInRadius) {
            // Calculate damage falloff based on distance
            const wallCenter = {
                x: wall.position.x + wall.width / 2,
                y: wall.position.y + wall.height / 2
            };
            const distance = Math.sqrt(Math.pow(position.x - wallCenter.x, 2) +
                Math.pow(position.y - wallCenter.y, 2));
            const falloffFactor = Math.max(0, 1 - (distance / radius));
            const finalDamage = damage * falloffFactor;
            if (finalDamage > 0) {
                // Apply damage to multiple slices based on explosion radius
                const slicesAffected = Math.ceil(radius / (wall.width / constants_1.GAME_CONFIG.DESTRUCTION.WALL_SLICES));
                const centerSlice = Math.floor(constants_1.GAME_CONFIG.DESTRUCTION.WALL_SLICES / 2);
                for (let i = 0; i < slicesAffected; i++) {
                    const sliceIndex = Math.max(0, Math.min(constants_1.GAME_CONFIG.DESTRUCTION.WALL_SLICES - 1, centerSlice + i - Math.floor(slicesAffected / 2)));
                    const damageEvent = this.applyDamage(wall.id, sliceIndex, finalDamage);
                    if (damageEvent) {
                        damageEvents.push(damageEvent);
                    }
                }
            }
        }
        return damageEvents;
    }
    // Get wall damage visualization data
    getWallDamageVisualization(wallId) {
        const wall = this.walls.get(wallId);
        if (!wall)
            return null;
        const sliceStates = [];
        for (let i = 0; i < constants_1.GAME_CONFIG.DESTRUCTION.WALL_SLICES; i++) {
            const healthPercent = this.getSliceHealth(wallId, i);
            const isDestroyed = this.isSliceDestroyed(wallId, i);
            let damageLevel;
            if (isDestroyed) {
                damageLevel = 'destroyed';
            }
            else if (healthPercent > 0.75) {
                damageLevel = 'none';
            }
            else if (healthPercent > 0.5) {
                damageLevel = 'light';
            }
            else if (healthPercent > 0.25) {
                damageLevel = 'medium';
            }
            else {
                damageLevel = 'heavy';
            }
            sliceStates.push({
                sliceIndex: i,
                healthPercent,
                isDestroyed,
                damageLevel
            });
        }
        return { sliceStates };
    }
    // Repair a wall slice (for testing/admin purposes)
    repairSlice(wallId, sliceIndex, healthToRestore = 100) {
        const wall = this.walls.get(wallId);
        if (!wall || sliceIndex < 0 || sliceIndex >= constants_1.GAME_CONFIG.DESTRUCTION.WALL_SLICES) {
            return false;
        }
        const currentHealth = wall.sliceHealth[sliceIndex];
        const newHealth = Math.min(wall.maxHealth, currentHealth + healthToRestore);
        wall.sliceHealth[sliceIndex] = newHealth;
        // Update bitmask based on health-based visibility logic
        const shouldAllowVision = (0, wallSliceHelpers_1.shouldSliceAllowVision)(wall.material, newHealth, wall.maxHealth);
        wall.destructionMask[sliceIndex] = shouldAllowVision ? 1 : 0;
        return true;
    }
    // Repair entire wall (for testing/admin purposes)
    repairWall(wallId) {
        const wall = this.walls.get(wallId);
        if (!wall)
            return false;
        // Restore all slices to full health
        for (let i = 0; i < constants_1.GAME_CONFIG.DESTRUCTION.WALL_SLICES; i++) {
            wall.sliceHealth[i] = wall.maxHealth;
            wall.destructionMask[i] = 0;
        }
        return true;
    }
    // Get destruction statistics
    getDestructionStats() {
        const totalWalls = this.walls.size;
        let destroyedWalls = 0;
        let totalSlices = 0;
        let destroyedSlices = 0;
        for (const [wallId, wall] of this.walls) {
            totalSlices += constants_1.GAME_CONFIG.DESTRUCTION.WALL_SLICES;
            let wallDestroyed = true;
            for (let i = 0; i < constants_1.GAME_CONFIG.DESTRUCTION.WALL_SLICES; i++) {
                if (wall.destructionMask[i] === 1) {
                    destroyedSlices++;
                }
                else {
                    wallDestroyed = false;
                }
            }
            if (wallDestroyed) {
                destroyedWalls++;
            }
        }
        return {
            totalWalls,
            destroyedWalls,
            totalSlices,
            destroyedSlices,
            overallDestructionPercentage: totalSlices > 0 ? (destroyedSlices / totalSlices) * 100 : 0
        };
    }
    // Clear all walls
    clear() {
        this.walls.clear();
        this.wallIdCounter = 0;
    }
    // Reset all walls to full health
    resetAllWalls() {
        for (const wall of this.walls.values()) {
            this.repairWall(wall.id);
        }
    }
    // Get spawn positions from loaded map
    getSpawnPositions() {
        return [...this.spawnPositions];
    }
}
exports.DestructionSystem = DestructionSystem;
