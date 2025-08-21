"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameStateSystem = void 0;
const constants_1 = require("../../shared/constants");
const WeaponSystem_1 = require("./WeaponSystem");
const ProjectileSystem_1 = require("./ProjectileSystem");
const DestructionSystem_1 = require("./DestructionSystem");
const VisibilityPolygonSystem_1 = require("./VisibilityPolygonSystem");
const SmokeZoneSystem_1 = require("./SmokeZoneSystem");
const FlashbangEffectSystem_1 = require("./FlashbangEffectSystem");
const WeaponDiagnostics_1 = require("./WeaponDiagnostics");
const matter_js_1 = __importDefault(require("matter-js"));
const wallSliceHelpers_1 = require("../utils/wallSliceHelpers");
class GameStateSystem {
    players = new Map();
    playerBodies = new Map();
    lastUpdateTime = Date.now();
    physics;
    weaponSystem;
    projectileSystem;
    destructionSystem;
    visionSystem;
    smokeZoneSystem;
    flashbangEffectSystem;
    lastInputSequence = new Map();
    pendingWallDamageEvents = [];
    pendingReloadCompleteEvents = [];
    pendingProjectileEvents = [];
    pendingDeathEvents = [];
    wallsUpdatedThisTick = false;
    visionUpdateCounter = 0;
    spawnPositions = { red: [], blue: [] };
    constructor(physics) {
        this.physics = physics;
        // Initialize systems
        this.destructionSystem = new DestructionSystem_1.DestructionSystem(physics);
        this.weaponSystem = new WeaponSystem_1.WeaponSystem();
        this.projectileSystem = new ProjectileSystem_1.ProjectileSystem(physics, this.weaponSystem, this.destructionSystem);
        // Initialize tactical systems
        this.smokeZoneSystem = new SmokeZoneSystem_1.SmokeZoneSystem();
        this.flashbangEffectSystem = new FlashbangEffectSystem_1.FlashbangEffectSystem();
        // Initialize polygon vision system with smoke integration
        this.visionSystem = new VisibilityPolygonSystem_1.VisibilityPolygonSystem(this.smokeZoneSystem);
        // Log vision system status
        console.log(`🔍 Vision system: ${constants_1.GAME_CONFIG.VISION.ENABLED ? 'ENABLED' : 'DISABLED'}`);
        if (!constants_1.GAME_CONFIG.VISION.ENABLED) {
            console.log('   → Sending full-map polygon to frontend');
            console.log('   → All players can see the entire map');
        }
        // Don't initialize walls here - will be done in initialize()
        // Set up reload complete callback
        this.weaponSystem.setReloadCompleteCallback((playerId, weapon) => {
            this.pendingReloadCompleteEvents.push({
                type: constants_1.EVENTS.WEAPON_RELOADED,
                data: {
                    playerId,
                    weaponType: weapon.type,
                    currentAmmo: weapon.currentAmmo,
                    reserveAmmo: weapon.reserveAmmo
                }
            });
        });
        // Set up machine gun heat update callback
        this.weaponSystem.setHeatUpdateCallback((event) => {
            this.pendingProjectileEvents.push({
                type: constants_1.EVENTS.WEAPON_HEAT_UPDATE,
                data: event
            });
        });
        // console.log('GameStateSystem initialized with weapon and vision systems');
    }
    async initialize() {
        // Initialize destruction system (loads map if specified)
        await this.destructionSystem.initialize();
        // Now initialize walls in vision system
        this.initializeWalls();
    }
    initializeWalls() {
        // Get walls from destruction system and pass to vision system
        const walls = this.destructionSystem.getWalls();
        console.log(`🧱 Initializing ${walls.size} walls for GameStateSystem`);
        const wallData = Array.from(walls.entries()).map(([id, wall]) => ({
            id: id,
            x: wall.position.x,
            y: wall.position.y,
            width: wall.width,
            height: wall.height,
            material: wall.material,
            sliceHealth: [...wall.sliceHealth],
            maxHealth: wall.maxHealth,
            destructionMask: Array.from(wall.destructionMask) // Pass destruction mask for partial walls
        }));
        this.visionSystem.initializeWalls(wallData);
        // Get spawn positions from destruction system (if loaded from map)
        const spawns = this.destructionSystem.getSpawnPositions();
        if (spawns.length > 0) {
            this.setSpawnPositions(spawns);
        }
        // CRITICAL: Get team-specific spawn positions
        const teamSpawns = this.destructionSystem.getTeamSpawnPositions();
        if (teamSpawns.red.length > 0 || teamSpawns.blue.length > 0) {
            this.spawnPositions = teamSpawns;
            console.log(`📍 Set team spawn positions - Red: ${teamSpawns.red.length}, Blue: ${teamSpawns.blue.length}`);
        }
    }
    setSpawnPositions(spawns) {
        // Reset spawn arrays
        this.spawnPositions.red = [];
        this.spawnPositions.blue = [];
        // Alternate between red and blue teams
        spawns.forEach((spawn, index) => {
            if (index % 2 === 0) {
                this.spawnPositions.red.push(spawn);
            }
            else {
                this.spawnPositions.blue.push(spawn);
            }
        });
        console.log(`📍 Set spawn positions - Red: ${this.spawnPositions.red.length}, Blue: ${this.spawnPositions.blue.length}`);
    }
    createPlayer(id) {
        // Don't create default weapons - frontend will send weapon:equip event
        const player = {
            id,
            transform: {
                position: { x: 240, y: 135 },
                rotation: 0,
                scale: { x: 1, y: 1 }
            },
            velocity: { x: 0, y: 0 },
            health: constants_1.GAME_CONFIG.PLAYER_HEALTH,
            armor: 0,
            team: 'red', // Default to red, will be updated by frontend in player:join
            weaponId: '', // No default weapon
            weapons: new Map(), // Empty weapons map - will be populated by weapon:equip
            isAlive: true,
            movementState: 'idle',
            isADS: false,
            lastDamageTime: 0,
            kills: 0,
            deaths: 0
        };
        // Debug weapon initialization
        console.log(`\n🎮 [PLAYER CREATED] ${id}`);
        console.log(`   No default weapons - waiting for weapon:equip event from frontend`);
        console.log(`🎨 [TEAM DEBUG] Player ${id.substring(0, 8)} created with default team: ${player.team}`);
        // Try to use spawn positions from map if available
        const teamSpawns = this.spawnPositions[player.team];
        console.log(`📍 [SPAWN] Player ${id.substring(0, 8)} team: ${player.team}`);
        console.log(`   Available spawns: Red=${this.spawnPositions.red.length}, Blue=${this.spawnPositions.blue.length}`);
        if (teamSpawns && teamSpawns.length > 0) {
            // Pick a random spawn from team spawns
            const spawn = teamSpawns[Math.floor(Math.random() * teamSpawns.length)];
            // CRITICAL: Create proper deep copy to prevent reference sharing
            player.transform.position = { x: spawn.x, y: spawn.y };
            console.log(`   ✅ Using ${player.team} team spawn: (${spawn.x}, ${spawn.y})`);
        }
        else {
            console.log(`   ⚠️ No ${player.team} team spawns available, using random position`);
            // Fall back to finding a safe spawn position
            let spawnAttempts = 0;
            while (spawnAttempts < 10 && !this.canPlayerMoveTo(id, player.transform.position)) {
                // Try different spawn positions
                player.transform.position.x = 50 + Math.random() * (constants_1.GAME_CONFIG.GAME_WIDTH - 100);
                player.transform.position.y = 50 + Math.random() * (constants_1.GAME_CONFIG.GAME_HEIGHT - 100);
                spawnAttempts++;
            }
            if (spawnAttempts >= 10) {
                console.warn(`   ❌ Could not find valid spawn position after 10 attempts!`);
            }
            else {
                console.log(`   📍 Using random spawn: (${player.transform.position.x.toFixed(0)}, ${player.transform.position.y.toFixed(0)})`);
            }
        }
        // Create physics body for the player
        const body = matter_js_1.default.Bodies.circle(player.transform.position.x, player.transform.position.y, constants_1.GAME_CONFIG.PLAYER_SIZE / 2, {
            friction: 0.1,
            frictionAir: 0.05,
            restitution: 0.1,
            label: `player:${id}`,
            render: { visible: false }
        });
        // Debug logs disabled for performance
        // console.log(`🔧 CREATING PLAYER BODY at position: (${player.transform.position.x}, ${player.transform.position.y})`);
        // console.log(`🎮 PLAYER SPAWNED: ${id} at (${player.transform.position.x}, ${player.transform.position.y})`);
        this.physics.addBody(body);
        this.playerBodies.set(id, body);
        // console.log(`🔧 PHYSICS BODY CREATED at: (${body.position.x}, ${body.position.y})`);
        // console.log(`🔧 PHYSICS BODY AFTER ADDING TO WORLD: (${body.position.x}, ${body.position.y})`);
        this.players.set(id, player);
        this.lastInputSequence.set(id, 0);
        // DEBUG: DISABLED FOR PERFORMANCE - this was creating intervals for every player!
        // setInterval(() => {
        //   const currentPlayer = this.players.get(id);
        //   if (currentPlayer && currentPlayer.isAlive) {
        //     console.log(`📍 POSITION CHECK ${id.substring(0, 8)}: (${currentPlayer.transform.position.x.toFixed(2)}, ${currentPlayer.transform.position.y.toFixed(2)}) | vel: (${currentPlayer.velocity.x.toFixed(2)}, ${currentPlayer.velocity.y.toFixed(2)}) | state: ${currentPlayer.movementState}`);
        //   }
        // }, 1000);
        return player;
    }
    getPlayer(id) {
        return this.players.get(id);
    }
    // Reset all game state without recreating systems
    async resetAllState() {
        console.log('🧹 Resetting all game state...');
        // Clear all player state
        for (const [playerId] of this.players) {
            this.removePlayer(playerId);
        }
        // Clear input tracking
        this.lastInputSequence.clear();
        // Clear all pending events
        this.pendingWallDamageEvents = [];
        this.pendingReloadCompleteEvents = [];
        this.pendingProjectileEvents = [];
        this.pendingDeathEvents = [];
        // Reset wall update tracking
        this.wallsUpdatedThisTick = false;
        this.visionUpdateCounter = 0;
        // Clear projectiles
        this.projectileSystem.clear();
        // Reset walls from map file (preserves partial walls)
        console.log('🎯 GameStateSystem.resetAllState: Calling resetFromMap...');
        await this.destructionSystem.resetFromMap();
        console.log('🎯 GameStateSystem.resetAllState: resetFromMap completed');
        // Re-initialize vision system with fresh wall data
        this.initializeWalls();
        console.log('✅ All game state reset complete');
    }
    // Reset only walls from map (for debug purposes)
    async resetWallsFromMap() {
        console.log('🔧 Resetting walls from map (debug)...');
        // Clear projectiles that might be in flight
        this.projectileSystem.clear();
        // Reset walls from map file
        await this.destructionSystem.resetFromMap();
        // Re-initialize vision system with fresh wall data
        this.initializeWalls();
        console.log('✅ Walls reset from map complete');
    }
    getPlayers() {
        return this.players;
    }
    removePlayer(id) {
        const body = this.playerBodies.get(id);
        if (body) {
            this.physics.removeBody(body);
            this.playerBodies.delete(id);
        }
        // Get player before removing for cleanup
        const player = this.players.get(id);
        // Clean up all player-related state
        this.players.delete(id);
        this.lastInputSequence.delete(id);
        // Clean up vision state
        this.visionSystem.removePlayer(id);
        // CRITICAL FIX: Clean up weapon system state
        if (player) {
            // Clear the player's weapons Map completely to prevent reference sharing
            player.weapons.clear();
        }
        // CRITICAL FIX: Clean up projectiles owned by this player
        const projectiles = this.projectileSystem.getProjectiles();
        for (let i = projectiles.length - 1; i >= 0; i--) {
            const projectile = projectiles[i];
            if (projectile.ownerId === id) {
                this.projectileSystem.removeProjectile(projectile.id);
            }
        }
        console.log(`🧹 [CLEANUP] Player ${id.substring(0, 8)} completely removed with all associated state`);
    }
    // Respawn player at correct team spawn position - CRITICAL FIX: Never use (0,0)
    respawnPlayerAtTeamSpawn(playerId) {
        const player = this.players.get(playerId);
        if (!player)
            return;
        console.log(`🎯 [TEAM SPAWN] Player ${playerId.substring(0, 8)} respawning:`);
        console.log(`   Stored team: ${player.team}`);
        console.log(`   Available spawns: Red=${this.spawnPositions.red.length}, Blue=${this.spawnPositions.blue.length}`);
        // Use hardcoded safe spawn positions if map spawns unavailable
        let spawnPosition;
        const teamSpawns = this.spawnPositions[player.team];
        if (teamSpawns && teamSpawns.length > 0) {
            // Use map-based spawn positions
            const spawn = teamSpawns[Math.floor(Math.random() * teamSpawns.length)];
            spawnPosition = { x: spawn.x, y: spawn.y };
            console.log(`   ✅ Using map spawn: (${spawnPosition.x}, ${spawnPosition.y})`);
        }
        else {
            // Use fallback spawn positions - NEVER (0,0)
            if (player.team === 'red') {
                spawnPosition = { x: 50, y: 135 }; // Left side
            }
            else {
                spawnPosition = { x: 430, y: 135 }; // Right side
            }
            console.log(`   ⚠️ Using fallback ${player.team} spawn: (${spawnPosition.x}, ${spawnPosition.y})`);
        }
        // CRITICAL: Validate spawn position is never (0,0)
        if (spawnPosition.x === 0 && spawnPosition.y === 0) {
            console.error(`❌ INVALID SPAWN POSITION (0,0) for player ${playerId}`);
            spawnPosition = player.team === 'red' ? { x: 50, y: 135 } : { x: 430, y: 135 };
            console.log(`   🔧 Corrected to safe position: (${spawnPosition.x}, ${spawnPosition.y})`);
        }
        player.transform.position = spawnPosition;
        // Update physics body position
        const body = this.playerBodies.get(playerId);
        if (body) {
            matter_js_1.default.Body.setPosition(body, spawnPosition);
        }
        console.log(`🎯 Respawned ${playerId.substring(0, 8)} at team ${player.team} spawn: (${spawnPosition.x}, ${spawnPosition.y})`);
    }
    // Handle player respawning - AUTO-RESPAWN DISABLED
    handleRespawning() {
        // CRITICAL FIX: Remove auto-respawn logic
        // Players must manually request respawn via 'player:respawn' event
        // This prevents players from auto-respawning without frontend consent
        // Optional: Clean up expired death timers for tracking purposes only
        const now = Date.now();
        for (const [playerId, player] of this.players) {
            if (!player.isAlive && player.deathTime) {
                // Track death time but don't auto-respawn
                // Client must explicitly send 'player:respawn' request
            }
        }
    }
    // Respawn a dead player - returns respawn data for immediate event emission
    respawnPlayer(playerId) {
        const player = this.players.get(playerId);
        if (!player || player.isAlive)
            return null;
        const now = Date.now();
        // Reset player state
        player.isAlive = true;
        player.health = constants_1.GAME_CONFIG.PLAYER_HEALTH;
        player.deathTime = undefined;
        player.respawnTime = undefined;
        player.killerId = undefined;
        player.invulnerableUntil = now + constants_1.GAME_CONFIG.DEATH.INVULNERABILITY_TIME;
        // Respawn at team spawn
        this.respawnPlayerAtTeamSpawn(playerId);
        console.log(`�� Player ${playerId.substring(0, 8)} respawned with ${constants_1.GAME_CONFIG.DEATH.INVULNERABILITY_TIME}ms invulnerability`);
        // Return respawn data for immediate emission (GameRoom will send the event)
        // Don't queue it here to avoid duplicate events
        return {
            playerId: player.id,
            position: { ...player.transform.position },
            health: player.health,
            team: player.team,
            invulnerableUntil: player.invulnerableUntil,
            timestamp: now
        };
    }
    // Debug method to kill a player for testing
    debugKillPlayer(playerId) {
        const player = this.players.get(playerId);
        if (player && player.isAlive) {
            this.applyPlayerDamage(player, 999, 'explosion', 'debug', player.transform.position);
        }
    }
    handlePlayerInput(playerId, input) {
        const player = this.players.get(playerId);
        const body = this.playerBodies.get(playerId);
        // DEBUG: Log why input might be rejected
        if (!player) {
            console.log(`❌ handlePlayerInput: No player found for ${playerId}`);
            return;
        }
        if (!body) {
            console.log(`❌ handlePlayerInput: No physics body for ${playerId}`);
            console.log(`   Available bodies: ${Array.from(this.playerBodies.keys()).join(', ')}`);
            return;
        }
        // Allow some input from dead players (for spectating, respawn requests)
        if (!player.isAlive) {
            // Dead players can still rotate camera/aim
            this.updatePlayerRotation(player, input);
            return;
        }
        // Debug: Log input details
        const beforePos = { ...player.transform.position };
        // Input validation - prevent cheating
        if (!this.validateInput(playerId, input)) {
            // Silently allow input to pass through (temporary fix for clock drift)
            // TODO: Fix frontend timestamp synchronization
            // return;
        }
        // Update input sequence tracking
        this.lastInputSequence.set(playerId, input.sequence);
        // CRITICAL: Track last processed input for client prediction
        player.lastProcessedInput = input.sequence;
        // Handle weapon inputs
        this.handleWeaponInputs(playerId, input);
        // Handle movement inputs
        this.handleMovementInputs(playerId, input);
        // Handle ADS (aim down sights)
        if (input.mouse.rightPressed) {
            player.isADS = !player.isADS;
        }
        // Handle rotation based on mouse position
        this.updatePlayerRotation(player, input);
        // Debug: DISABLED FOR PERFORMANCE
        // if (beforePos.x !== player.transform.position.x || beforePos.y !== player.transform.position.y) {
        //   console.log(`🎮 INPUT ${playerId.substring(0, 8)} seq:${input.sequence} | before: (${beforePos.x.toFixed(2)}, ${beforePos.y.toFixed(2)}) → after: (${player.transform.position.x.toFixed(2)}, ${player.transform.position.y.toFixed(2)}) | keys: ${Object.entries(input.keys).filter(([k, v]) => v).map(([k]) => k).join(',')}`);
        // }
    }
    handleWeaponInputs(playerId, input) {
        const player = this.players.get(playerId);
        if (!player)
            return;
        // Handle weapon firing - check both leftPressed and buttons field
        if (input.mouse.leftPressed || (input.mouse.buttons & 1)) {
            // OPTIMIZATION: Check fire rate BEFORE creating event
            const weapon = player.weapons.get(player.weaponId);
            if (weapon) {
                const now = Date.now();
                const fireInterval = (60 / weapon.fireRate) * 1000;
                // Only process fire event if enough time has passed
                if (now - weapon.lastFireTime >= fireInterval) {
                    const weaponFireEvent = {
                        playerId,
                        weaponType: player.weaponId,
                        position: { ...player.transform.position },
                        direction: player.transform.rotation,
                        isADS: player.isADS,
                        timestamp: now,
                        sequence: input.sequence,
                        pelletCount: player.weaponId === 'shotgun' ? 8 : undefined
                    };
                    this.handleWeaponFire(weaponFireEvent);
                }
                // Else: Rate limited, don't even create the event
            }
        }
        // Handle weapon switching
        // Try to switch to primary weapon (key 1)
        if (input.keys['1']) {
            const primary = Array.from(player.weapons.keys()).find(w => ['rifle', 'smg', 'shotgun', 'battlerifle', 'sniperrifle'].includes(w));
            if (primary && player.weaponId !== primary) {
                this.handleWeaponSwitch(playerId, primary);
            }
        }
        // Try to switch to secondary weapon (key 2)
        if (input.keys['2']) {
            const secondary = Array.from(player.weapons.keys()).find(w => ['pistol', 'revolver', 'suppressedpistol'].includes(w));
            if (secondary && player.weaponId !== secondary) {
                this.handleWeaponSwitch(playerId, secondary);
            }
        }
        // Cycle through support weapons with keys 3-4
        const supportWeapons = Array.from(player.weapons.keys()).filter(w => ['grenade', 'smokegrenade', 'flashbang', 'grenadelauncher', 'machinegun', 'antimaterialrifle', 'rocket'].includes(w));
        if (input.keys['3'] && supportWeapons[0] && player.weaponId !== supportWeapons[0]) {
            this.handleWeaponSwitch(playerId, supportWeapons[0]);
        }
        if (input.keys['4'] && supportWeapons[1] && player.weaponId !== supportWeapons[1]) {
            this.handleWeaponSwitch(playerId, supportWeapons[1]);
        }
        // Handle reload
        if (input.keys.r) {
            this.handleWeaponReload(playerId);
        }
        // Handle grenade throwing
        if (input.keys.g) {
            const weapon = player.weapons.get(player.weaponId);
            if (weapon && ['grenade', 'smokegrenade', 'flashbang'].includes(weapon.type)) {
                // For now, treat G key as instant throw with charge level 3 for grenades, 1 for others
                const chargeLevel = weapon.type === 'grenade' ? 3 : 1;
                const grenadeThrowEvent = {
                    playerId,
                    position: { ...player.transform.position },
                    direction: player.transform.rotation,
                    chargeLevel: chargeLevel,
                    timestamp: Date.now()
                };
                this.handleGrenadeThrow(grenadeThrowEvent);
            }
        }
    }
    handleMovementInputs(playerId, input) {
        const player = this.players.get(playerId);
        if (!player)
            return;
        // Calculate movement vector from WASD input
        const movementVector = this.calculateMovementVector(input);
        // Determine movement state and speed modifier
        const movementState = this.getMovementState(input, movementVector);
        const speedModifier = this.getSpeedModifier(movementState);
        // Apply movement
        if (movementVector.x !== 0 || movementVector.y !== 0) {
            // Normalize diagonal movement
            const magnitude = Math.sqrt(movementVector.x * movementVector.x + movementVector.y * movementVector.y);
            const normalizedVector = {
                x: movementVector.x / magnitude,
                y: movementVector.y / magnitude
            };
            // Calculate final velocity
            const baseSpeed = constants_1.GAME_CONFIG.PLAYER_SPEED_WALK;
            const finalSpeed = baseSpeed * speedModifier;
            const targetVelocity = {
                x: normalizedVector.x * finalSpeed,
                y: normalizedVector.y * finalSpeed
            };
            // Apply position directly (physics bypassed temporarily)
            const deltaTime = 1000 / constants_1.GAME_CONFIG.TICK_RATE; // 16.67ms
            const deltaSeconds = deltaTime / 1000; // Convert to seconds
            const positionDelta = {
                x: targetVelocity.x * deltaSeconds,
                y: targetVelocity.y * deltaSeconds
            };
            // Debug: DISABLED FOR PERFORMANCE
            // if (Math.random() < 0.05) { // Log 5% of movements to avoid spam
            //   console.log(`🏃 MOVEMENT CALC ${playerId.substring(0, 8)}:`);
            //   console.log(`   Input: ${Object.entries(input.keys).filter(([k, v]) => v && ['w','a','s','d','shift','ctrl'].includes(k)).map(([k]) => k).join(',')}`);
            //   console.log(`   Movement vector: (${movementVector.x}, ${movementVector.y})`);
            //   console.log(`   Speed: base=${baseSpeed}, modifier=${speedModifier}, final=${finalSpeed}`);
            //   console.log(`   Delta: time=${deltaTime}ms, seconds=${deltaSeconds}`);
            //   console.log(`   Position delta: (${positionDelta.x.toFixed(4)}, ${positionDelta.y.toFixed(4)})`);
            // }
            // Calculate intended position
            const intendedPosition = {
                x: player.transform.position.x + positionDelta.x,
                y: player.transform.position.y + positionDelta.y
            };
            // Check if player can move to intended position
            if (this.canPlayerMoveTo(playerId, intendedPosition)) {
                player.transform.position = intendedPosition;
            }
            else {
                // Try sliding along walls
                const slidePosition = this.calculateSlidePosition(player.transform.position, intendedPosition);
                if (slidePosition) {
                    player.transform.position = slidePosition;
                    // Debug collision
                    if (Math.random() < 0.1) { // 10% chance
                        // console.log(`🧱 WALL SLIDE ${playerId.substring(0, 8)}: intended(${intendedPosition.x.toFixed(1)}, ${intendedPosition.y.toFixed(1)}) → slide(${slidePosition.x.toFixed(1)}, ${slidePosition.y.toFixed(1)})`);
                    }
                }
                else {
                    // Can't move at all - log collision
                    if (Math.random() < 0.1) { // 10% chance
                        // console.log(`🚫 BLOCKED ${playerId.substring(0, 8)}: at (${player.transform.position.x.toFixed(1)}, ${player.transform.position.y.toFixed(1)})`);
                    }
                }
            }
            // Update player velocity in state
            player.velocity = targetVelocity;
        }
        else {
            // No movement input - apply friction directly to player state
            player.velocity = {
                x: player.velocity.x * 0.8,
                y: player.velocity.y * 0.8
            };
        }
        // Update movement state
        player.movementState = movementState;
    }
    // Handle weapon fire event
    handleWeaponFire(event) {
        const player = this.players.get(event.playerId);
        if (!player) {
            WeaponDiagnostics_1.WeaponDiagnostics.logError('handleWeaponFire', `Player not found: ${event.playerId}`);
            return { success: false, events: [] };
        }
        const fireResult = this.weaponSystem.handleWeaponFire(event, player);
        if (!fireResult.canFire) {
            // Rate limited - don't send events for rejected shots
            return { success: false, events: [] };
        }
        const weapon = fireResult.weapon;
        const weaponConfig = this.weaponSystem.getWeaponConfig(weapon.type);
        const events = [];
        // Check if this is a throwable weapon that should be converted to a throw event
        const throwableWeapons = ['grenade', 'smokegrenade', 'flashbang'];
        if (throwableWeapons.includes(weapon.type)) {
            // Converting fire event to throw event
            // Convert to a grenade throw event with default charge level
            const grenadeThrowEvent = {
                playerId: event.playerId,
                position: event.position,
                direction: event.direction,
                chargeLevel: weapon.type === 'grenade' ? 3 : 1, // Default charge levels
                timestamp: event.timestamp
            };
            const throwResult = this.handleGrenadeThrow(grenadeThrowEvent);
            // Add weapon:fired event to the throw result events for frontend compatibility
            if (throwResult.success) {
                throwResult.events.push({
                    type: constants_1.EVENTS.WEAPON_FIRED,
                    data: {
                        playerId: event.playerId,
                        weaponType: weapon.type,
                        position: event.position,
                        direction: event.direction,
                        ammoRemaining: weapon.currentAmmo, // Already decremented in handleGrenadeThrow
                        timestamp: Date.now(),
                        isGrenade: true // Special flag for grenade throws
                    }
                });
            }
            return throwResult;
        }
        // Handle hitscan weapons
        if (weaponConfig.HITSCAN) {
            // Special handling for shotgun
            if (weapon.type === 'shotgun') {
                const pelletCount = weaponConfig.PELLET_COUNT || 8;
                const pelletDirections = this.weaponSystem.generateShotgunPellets(event.direction, pelletCount);
                const damagePerPellet = weapon.damage / pelletCount;
                // Calculate offset position in front of player to prevent self-hits
                const playerRadius = constants_1.GAME_CONFIG.PLAYER_SIZE / 2;
                const offsetDistance = playerRadius + 2; // Start pellets 2 pixels beyond player edge
                const offsetPosition = {
                    x: event.position.x + Math.cos(event.direction) * offsetDistance,
                    y: event.position.y + Math.sin(event.direction) * offsetDistance
                };
                // Shotgun firing from offset position
                // Track all pellet hits for the event
                const allPelletHits = [];
                let selfHitCount = 0;
                for (let pelletIndex = 0; pelletIndex < pelletDirections.length; pelletIndex++) {
                    const pelletDirection = pelletDirections[pelletIndex];
                    const pelletHits = this.weaponSystem.performHitscanWithPenetration(offsetPosition, // Use offset position instead of player center
                    pelletDirection, weapon.range, { ...weapon, damage: damagePerPellet }, // Temporary weapon with reduced damage
                    player, this.destructionSystem.getWalls(), this.players);
                    // Processing pellet hits
                    // Track if this pellet hit anything at all
                    let pelletHitSomething = false;
                    // Process each pellet's hits
                    for (const hit of pelletHits) {
                        allPelletHits.push(hit);
                        pelletHitSomething = true;
                        // Check for self-hit (debugging)
                        if (hit.targetType === 'player' && hit.targetId === event.playerId) {
                            selfHitCount++;
                            // Self-hit detected
                        }
                        // Send individual pellet event based on hit type
                        if (hit.targetType === 'player') {
                            // Apply damage to the player
                            const targetPlayer = this.players.get(hit.targetId);
                            if (targetPlayer) {
                                const damageEvent = this.applyPlayerDamage(targetPlayer, damagePerPellet, 'bullet', event.playerId, hit.hitPoint);
                                events.push({ type: constants_1.EVENTS.PLAYER_DAMAGED, data: damageEvent });
                                if (damageEvent.isKilled) {
                                    // ✅ CRITICAL FIX: Don't send PLAYER_KILLED event - backend:player:died is already sent by applyPlayerDamage
                                    // Removing duplicate kill event to prevent double-counting
                                    // events.push({ type: EVENTS.PLAYER_KILLED, data: damageEvent });
                                }
                            }
                            // Send weapon:hit event for frontend trail
                            events.push({
                                type: constants_1.EVENTS.WEAPON_HIT,
                                data: {
                                    playerId: event.playerId,
                                    weaponType: weapon.type,
                                    position: hit.hitPoint,
                                    targetType: 'player',
                                    targetId: hit.targetId,
                                    pelletIndex: pelletIndex // Frontend needs this!
                                }
                            });
                        }
                        else if (hit.targetType === 'wall') {
                            // Apply damage to the wall
                            if (hit.wallSliceIndex !== undefined) {
                                const wall = this.destructionSystem.getWall(hit.targetId);
                                if (wall) {
                                    const damageEvent = this.destructionSystem.applyDamage(hit.targetId, hit.wallSliceIndex, damagePerPellet);
                                    if (damageEvent) {
                                        // Send wall:damaged event for destruction system
                                        events.push({ type: constants_1.EVENTS.WALL_DAMAGED, data: {
                                                ...damageEvent,
                                                weaponType: weapon.type,
                                                material: wall.material || 'concrete',
                                                playerId: event.playerId,
                                                pelletIndex: pelletIndex
                                            } });
                                        this.visionSystem.onWallDestroyed(hit.targetId, wall, damageEvent.sliceIndex);
                                        if (damageEvent.isDestroyed) {
                                            events.push({ type: constants_1.EVENTS.WALL_DESTROYED, data: {
                                                    ...damageEvent,
                                                    weaponType: weapon.type
                                                } });
                                        }
                                    }
                                }
                            }
                            // Send weapon:hit event for frontend trail
                            events.push({
                                type: constants_1.EVENTS.WEAPON_HIT,
                                data: {
                                    playerId: event.playerId,
                                    weaponType: weapon.type,
                                    position: hit.hitPoint,
                                    targetType: 'wall',
                                    targetId: hit.targetId,
                                    pelletIndex: pelletIndex // Frontend needs this!
                                }
                            });
                        }
                        // Pellets don't penetrate - break after first hit
                        break;
                    }
                    // If this pellet didn't hit anything, send weapon:miss event
                    if (!pelletHitSomething) {
                        // Calculate where the pellet would end up if it traveled max range
                        const missPosition = {
                            x: offsetPosition.x + Math.cos(pelletDirection) * weapon.range,
                            y: offsetPosition.y + Math.sin(pelletDirection) * weapon.range
                        };
                        events.push({
                            type: constants_1.EVENTS.WEAPON_MISS,
                            data: {
                                playerId: event.playerId,
                                weaponType: weapon.type,
                                position: missPosition,
                                direction: pelletDirection,
                                pelletIndex: pelletIndex // Frontend needs this!
                            }
                        });
                        // Pellet missed
                    }
                }
                // Shotgun fire complete
                // Individual pellet events are now sent above - no need for summary event
                // Sent individual pellet events
            }
            else {
                // Regular hitscan handling for other weapons
                const penetrationHits = this.weaponSystem.performHitscanWithPenetration(event.position, event.direction, weapon.range, weapon, player, this.destructionSystem.getWalls(), this.players);
                // Process all hits from penetration
                if (penetrationHits.length > 0) {
                    for (const hit of penetrationHits) {
                        if (hit.targetType === 'player') {
                            // Player hit
                            const targetPlayer = this.players.get(hit.targetId);
                            if (targetPlayer) {
                                const damageEvent = this.applyPlayerDamage(targetPlayer, hit.damage, 'bullet', event.playerId, hit.hitPoint);
                                events.push({ type: constants_1.EVENTS.PLAYER_DAMAGED, data: damageEvent });
                                if (damageEvent.isKilled) {
                                    // ✅ CRITICAL FIX: Don't send PLAYER_KILLED event - backend:player:died is already sent by applyPlayerDamage
                                    // Removing duplicate kill event to prevent double-counting
                                    // events.push({ type: EVENTS.PLAYER_KILLED, data: damageEvent });
                                }
                            }
                        }
                        else if (hit.targetType === 'wall' && hit.wallSliceIndex !== undefined) {
                            // Wall hit
                            const wall = this.destructionSystem.getWall(hit.targetId);
                            if (wall) {
                                const damageEvent = this.destructionSystem.applyDamage(hit.targetId, hit.wallSliceIndex, hit.damage);
                                if (damageEvent) {
                                    events.push({ type: constants_1.EVENTS.WALL_DAMAGED, data: {
                                            ...damageEvent,
                                            weaponType: weapon.type, // Frontend requires this
                                            material: wall.material || 'concrete' // Frontend requires this
                                        } });
                                    // Notify vision system of wall destruction
                                    this.visionSystem.onWallDestroyed(hit.targetId, wall, damageEvent.sliceIndex);
                                    if (damageEvent.isDestroyed) {
                                        events.push({ type: constants_1.EVENTS.WALL_DESTROYED, data: {
                                                ...damageEvent,
                                                weaponType: weapon.type
                                            } });
                                    }
                                }
                            }
                        }
                    }
                    // Use the first hit for the hit event
                    const firstHit = penetrationHits[0];
                    events.push({ type: constants_1.EVENTS.WEAPON_HIT, data: {
                            playerId: event.playerId,
                            weaponType: weapon.type, // Frontend requires this
                            position: firstHit.hitPoint,
                            targetType: firstHit.targetType,
                            targetId: firstHit.targetId,
                            penetrationCount: penetrationHits.length
                        } });
                }
                else {
                    events.push({ type: constants_1.EVENTS.WEAPON_MISS, data: {
                            playerId: event.playerId,
                            weaponType: weapon.type, // Frontend requires this
                            position: event.position,
                            direction: event.direction
                        } });
                }
            }
        }
        else {
            // Handle projectile weapons (grenade, rocket)
            let velocity;
            let projectileOptions = {
                range: weapon.range,
                explosionRadius: weaponConfig.EXPLOSION_RADIUS
            };
            if (weapon.type === 'grenadelauncher') {
                // Grenade launcher uses arc trajectory
                velocity = this.calculateProjectileVelocity(event.direction, weaponConfig.PROJECTILE_SPEED);
                projectileOptions.fuseTime = constants_1.GAME_CONFIG.WEAPONS.GRENADELAUNCHER.FUSE_TIME || 3000;
                projectileOptions.explosionRadius = weaponConfig.EXPLOSION_RADIUS;
            }
            else {
                // Regular projectile (rocket)
                velocity = this.calculateProjectileVelocity(event.direction, weaponConfig.PROJECTILE_SPEED);
                // Creating rocket projectile
            }
            const projectile = this.projectileSystem.createProjectile(weapon.type, event.position, velocity, event.playerId, weapon.damage, projectileOptions);
            events.push({
                type: constants_1.EVENTS.PROJECTILE_CREATED,
                data: {
                    id: projectile.id,
                    type: projectile.type,
                    playerId: projectile.ownerId,
                    position: { x: projectile.position.x, y: projectile.position.y },
                    velocity: { x: projectile.velocity.x, y: projectile.velocity.y },
                    timestamp: projectile.timestamp
                }
            });
        }
        // Add weapon fired event with full trail data
        events.push({
            type: constants_1.EVENTS.WEAPON_FIRED,
            data: {
                playerId: event.playerId,
                weaponType: weapon.type,
                position: event.position, // Start position for trail
                direction: event.direction,
                ammoRemaining: weapon.currentAmmo,
                timestamp: Date.now(), // For synchronization
                isADS: event.isADS // For different effects when aiming
            }
        });
        // Debug automatic weapons
        const automaticWeapons = ['rifle', 'smg', 'machinegun'];
        if (automaticWeapons.includes(weapon.type)) {
            // Auto fire event generated
        }
        return { success: true, events };
    }
    // Handle weapon reload
    handleWeaponReload(playerId) {
        const player = this.players.get(playerId);
        if (!player) {
            return { success: false, events: [] };
        }
        const reloadEvent = {
            playerId,
            weaponType: player.weaponId,
            timestamp: Date.now()
        };
        const reloadResult = this.weaponSystem.handleWeaponReload(reloadEvent, player);
        if (!reloadResult.canReload) {
            // console.log(`🔄 Reload failed for ${playerId}: ${reloadResult.error}`);
            return { success: false, events: [] };
        }
        const weapon = reloadResult.weapon;
        const events = [
            { type: constants_1.EVENTS.WEAPON_RELOAD, data: { playerId, weaponType: weapon.type, reloadTime: weapon.reloadTime } }
        ];
        return { success: true, events };
    }
    // Handle weapon switch
    handleWeaponSwitch(playerId, weaponType) {
        const player = this.players.get(playerId);
        if (!player) {
            return { success: false, events: [] };
        }
        // Weapon switch attempt
        const switchEvent = {
            playerId,
            fromWeapon: player.weaponId,
            toWeapon: weaponType,
            timestamp: Date.now()
        };
        const switchResult = this.weaponSystem.handleWeaponSwitch(switchEvent, player);
        if (!switchResult.canSwitch) {
            // Switch failed
            return { success: false, events: [] };
        }
        // Weapon switched successfully
        const events = [
            { type: constants_1.EVENTS.WEAPON_SWITCHED, data: { playerId, fromWeapon: switchEvent.fromWeapon, toWeapon: switchEvent.toWeapon } }
        ];
        return { success: true, events };
    }
    // Handle grenade throw
    handleGrenadeThrow(event) {
        const player = this.players.get(event.playerId);
        if (!player) {
            return { success: false, events: [] };
        }
        const throwResult = this.weaponSystem.handleGrenadeThrow(event, player);
        if (!throwResult.canThrow) {
            // console.log(`💣 Grenade throw failed for ${event.playerId}: ${throwResult.error}`);
            return { success: false, events: [] };
        }
        const weapon = throwResult.weapon;
        const weaponConfig = this.weaponSystem.getWeaponConfig(weapon.type);
        // Calculate velocity based on weapon type
        let velocity;
        let projectileOptions = {
            explosionRadius: weaponConfig.EXPLOSION_RADIUS
        };
        if (weapon.type === 'grenade') {
            // Use charge system for regular grenades - don't set fuseTime!
            const baseSpeed = constants_1.GAME_CONFIG.WEAPONS.GRENADE.BASE_THROW_SPEED;
            const chargeBonus = constants_1.GAME_CONFIG.WEAPONS.GRENADE.CHARGE_SPEED_BONUS;
            const speed = baseSpeed + (event.chargeLevel * chargeBonus);
            velocity = this.calculateProjectileVelocity(event.direction, speed);
            // Apply charge multiplier to range
            const chargeMultiplier = 1 + ((event.chargeLevel - 1) * 0.5);
            projectileOptions.range = weapon.range * chargeMultiplier;
            projectileOptions.chargeLevel = event.chargeLevel;
            projectileOptions.fuseTime = weaponConfig.FUSE_TIME; // 3 seconds
        }
        else {
            // Smoke grenades and flashbangs use fixed speed and fuse time
            velocity = this.calculateProjectileVelocity(event.direction, weaponConfig.PROJECTILE_SPEED);
            projectileOptions.range = weapon.range;
            projectileOptions.fuseTime = weaponConfig.FUSE_TIME;
        }
        const projectile = this.projectileSystem.createProjectile(weapon.type, event.position, velocity, event.playerId, weapon.damage, projectileOptions);
        // Debug log for grenades
        if (weapon.type === 'grenade') {
            // Grenade created
        }
        const events = [
            { type: constants_1.EVENTS.GRENADE_THROWN, data: {
                    playerId: event.playerId,
                    weaponType: weapon.type,
                    chargeLevel: event.chargeLevel,
                    ammoRemaining: weapon.currentAmmo
                } },
            { type: constants_1.EVENTS.PROJECTILE_CREATED, data: {
                    id: projectile.id,
                    type: projectile.type,
                    playerId: projectile.ownerId,
                    position: { x: projectile.position.x, y: projectile.position.y },
                    velocity: { x: projectile.velocity.x, y: projectile.velocity.y },
                    timestamp: projectile.timestamp
                } }
        ];
        return { success: true, events };
    }
    // Apply damage to player
    applyPlayerDamage(player, damage, damageType, sourcePlayerId, position) {
        // Check invulnerability after respawn
        const now = Date.now();
        if (player.invulnerableUntil && now < player.invulnerableUntil) {
            // Player is invulnerable
            return {
                playerId: player.id,
                damage: 0,
                damageType,
                sourcePlayerId,
                position,
                newHealth: player.health,
                isKilled: false,
                timestamp: now
            };
        }
        const newHealth = Math.max(0, player.health - damage);
        const isKilled = newHealth <= 0;
        player.health = newHealth;
        player.lastDamageTime = now;
        if (isKilled && player.isAlive) {
            // Mark player as dead
            player.isAlive = false;
            player.deaths++;
            player.deathTime = now;
            player.killerId = sourcePlayerId;
            player.respawnTime = now + constants_1.GAME_CONFIG.DEATH.RESPAWN_DELAY;
            // Player killed
            // Queue enhanced death event with kill attribution details
            const killer = this.players.get(sourcePlayerId);
            this.pendingDeathEvents.push({
                type: 'backend:player:died', // CRITICAL FIX: Use backend prefix for frontend compatibility
                data: {
                    playerId: player.id, // CONSISTENT: Always use playerId for victim
                    killerId: sourcePlayerId,
                    killerTeam: killer?.team || 'unknown',
                    victimTeam: player.team,
                    weaponType: killer?.weaponId || 'unknown',
                    isTeamKill: killer?.team === player.team,
                    position: { ...position },
                    damageType,
                    timestamp: now
                }
            });
            // Award kill to source player (only for enemy team eliminations)
            if (killer && killer.id !== player.id) {
                // ✅ CRITICAL FIX: Only count kills against opposing team
                if (killer.team !== player.team) {
                    killer.kills++;
                    // Kill credited
                }
                else {
                    // Team kill ignored
                }
            }
        }
        return {
            playerId: player.id,
            damage,
            damageType,
            sourcePlayerId,
            position,
            newHealth,
            isKilled,
            timestamp: Date.now()
        };
    }
    // Calculate projectile velocity
    calculateProjectileVelocity(direction, speed) {
        return {
            x: Math.cos(direction) * speed,
            y: Math.sin(direction) * speed
        };
    }
    validateInput(playerId, input) {
        // Check for malformed input structure
        if (!input || !input.mouse || input.sequence === undefined || input.timestamp === undefined) {
            return false;
        }
        // Check timestamp (prevent old/future inputs)
        const now = Date.now();
        const timeDiff = Math.abs(now - input.timestamp);
        if (timeDiff > 5000) { // 5 second tolerance for clock drift
            // Silently reject very old inputs
            return false;
        }
        // Check sequence number (prevent replay attacks)
        const lastSequence = this.lastInputSequence.get(playerId) || 0;
        if (input.sequence <= lastSequence) {
            // Be more lenient - allow some out-of-order packets
            if (input.sequence < lastSequence - 10) {
                // Silently reject very old sequence numbers
                return false;
            }
        }
        // Validate input ranges - check both game space and screen space
        const isGameSpace = input.mouse.x <= constants_1.GAME_CONFIG.GAME_WIDTH && input.mouse.y <= constants_1.GAME_CONFIG.GAME_HEIGHT;
        const isScreenSpace = input.mouse.x <= constants_1.GAME_CONFIG.GAME_WIDTH * constants_1.GAME_CONFIG.SCALE_FACTOR &&
            input.mouse.y <= constants_1.GAME_CONFIG.GAME_HEIGHT * constants_1.GAME_CONFIG.SCALE_FACTOR;
        if (!isGameSpace && !isScreenSpace) {
            // Silently reject out of bounds mouse positions
            return false;
        }
        if (input.mouse.buttons < 0 || input.mouse.buttons > 7) { // 3 bits for mouse buttons
            // Silently reject invalid button states
            return false;
        }
        return true;
    }
    calculateMovementVector(input) {
        let x = 0;
        let y = 0;
        if (input.keys.a)
            x -= 1;
        if (input.keys.d)
            x += 1;
        if (input.keys.w)
            y -= 1;
        if (input.keys.s)
            y += 1;
        return { x, y };
    }
    getMovementState(input, movementVector) {
        // No movement
        if (movementVector.x === 0 && movementVector.y === 0) {
            return 'idle';
        }
        // Check modifiers
        if (input.keys.ctrl) {
            return 'sneaking';
        }
        if (input.keys.shift) {
            return 'running';
        }
        return 'walking';
    }
    getSpeedModifier(movementState) {
        switch (movementState) {
            case 'sneaking':
                return constants_1.GAME_CONFIG.PLAYER_SPEED_SNEAK / constants_1.GAME_CONFIG.PLAYER_SPEED_WALK;
            case 'walking':
                return 1.0;
            case 'running':
                return constants_1.GAME_CONFIG.PLAYER_SPEED_RUN / constants_1.GAME_CONFIG.PLAYER_SPEED_WALK;
            default:
                return 0;
        }
    }
    updatePlayerRotation(player, input) {
        // Calculate rotation based on mouse position relative to player
        // Mouse coordinates are already in game space, no need to scale
        const deltaX = input.mouse.x - player.transform.position.x;
        const deltaY = input.mouse.y - player.transform.position.y;
        // Calculate angle in radians
        const angle = Math.atan2(deltaY, deltaX);
        // Debug: DISABLED FOR PERFORMANCE
        // if (Math.random() < 0.01) { // 1% chance to avoid spam
        //   console.log(`🎯 ROTATION ${player.id.substring(0, 8)}: mouse(${input.mouse.x.toFixed(1)}, ${input.mouse.y.toFixed(1)}) - player(${player.transform.position.x.toFixed(1)}, ${player.transform.position.y.toFixed(1)}) = angle ${(angle * 180 / Math.PI).toFixed(1)}°`);
        // }
        player.transform.rotation = angle;
    }
    // Check if a player can move to a new position (no wall collision)
    canPlayerMoveTo(playerId, newPosition) {
        const playerRadius = constants_1.GAME_CONFIG.PLAYER_SIZE / 2;
        const walls = this.destructionSystem.getWalls();
        // Check each wall for collision
        for (const [wallId, wall] of walls) {
            // Skip boundary walls for now (they're outside the game area)
            if (wall.position.x < 0 || wall.position.y < 0 ||
                wall.position.x >= constants_1.GAME_CONFIG.GAME_WIDTH ||
                wall.position.y >= constants_1.GAME_CONFIG.GAME_HEIGHT) {
                continue;
            }
            // Check if player circle overlaps with wall rectangle
            const closestX = Math.max(wall.position.x, Math.min(newPosition.x, wall.position.x + wall.width));
            const closestY = Math.max(wall.position.y, Math.min(newPosition.y, wall.position.y + wall.height));
            const distanceX = newPosition.x - closestX;
            const distanceY = newPosition.y - closestY;
            const distanceSquared = distanceX * distanceX + distanceY * distanceY;
            if (distanceSquared < playerRadius * playerRadius) {
                // Check if any slice in this wall is intact
                const closestPoint = { x: closestX, y: closestY };
                // Find which slice the collision point is in
                const sliceIndex = (0, wallSliceHelpers_1.calculateSliceIndex)(wall, closestPoint);
                // Check if the slice is intact
                if (sliceIndex >= 0 && sliceIndex < constants_1.GAME_CONFIG.DESTRUCTION.WALL_SLICES &&
                    wall.destructionMask[sliceIndex] === 0) {
                    return false; // Collision detected with intact slice
                }
                // Also check adjacent slices for edge cases
                for (let i = Math.max(0, sliceIndex - 1); i <= Math.min(constants_1.GAME_CONFIG.DESTRUCTION.WALL_SLICES - 1, sliceIndex + 1); i++) {
                    if (wall.destructionMask[i] === 0 && (0, wallSliceHelpers_1.isPointInSlice)(wall, closestPoint, i)) {
                        return false; // Collision with adjacent intact slice
                    }
                }
            }
        }
        return true; // No collision
    }
    // Calculate slide position when hitting a wall
    calculateSlidePosition(currentPos, intendedPos) {
        const deltaX = intendedPos.x - currentPos.x;
        const deltaY = intendedPos.y - currentPos.y;
        // Try sliding along X axis
        const slideX = { x: intendedPos.x, y: currentPos.y };
        if (this.canPlayerMoveTo('', slideX)) {
            return slideX;
        }
        // Try sliding along Y axis
        const slideY = { x: currentPos.x, y: intendedPos.y };
        if (this.canPlayerMoveTo('', slideY)) {
            return slideY;
        }
        return null; // Can't slide
    }
    // Legacy shoot handler (keeping for compatibility)
    handlePlayerShoot(playerId, data) {
        const player = this.players.get(playerId);
        if (!player || !player.isAlive)
            return;
        // TODO: Implement shooting logic
        // console.log(`Player ${playerId} shooting with weapon ${player.weaponId}`);
        // Create projectile based on player position and rotation
        // This would integrate with a ProjectileSystem
    }
    update(delta) {
        const now = Date.now();
        const deltaTime = now - this.lastUpdateTime;
        this.lastUpdateTime = now;
        // Reset wall update flag
        this.wallsUpdatedThisTick = false;
        // Update tactical systems
        this.smokeZoneSystem.update(deltaTime);
        // Update machine gun cooling and player effects for all players
        for (const [playerId, player] of this.players) {
            if (player.isAlive) {
                this.weaponSystem.cooldownMachineGuns(player.weapons, deltaTime);
                this.flashbangEffectSystem.updatePlayerEffects(player, deltaTime);
            }
        }
        // Handle player respawning
        this.handleRespawning();
        // Update projectile system - now with wall collision checking
        const projectileEvents = this.projectileSystem.update(deltaTime, this.destructionSystem.getWalls());
        // Queue projectile update events
        for (const updateEvent of projectileEvents.updateEvents) {
            this.pendingProjectileEvents.push({ type: constants_1.EVENTS.PROJECTILE_UPDATED, data: updateEvent });
        }
        // Queue projectile explode events and handle special explosion types
        for (const explodeEvent of projectileEvents.explodeEvents) {
            this.pendingProjectileEvents.push({ type: constants_1.EVENTS.PROJECTILE_EXPLODED, data: explodeEvent });
            // Handle special explosion types
            // Processing explosion event
            if (explodeEvent.type === 'smoke') {
                // Create smoke zone
                this.smokeZoneSystem.createSmokeZone(explodeEvent.id, explodeEvent.position);
                // Smoke grenade deployed
            }
            else if (explodeEvent.type === 'flash') {
                // Calculate flashbang effects on all players
                const flashEffect = this.flashbangEffectSystem.calculateFlashbangEffects(explodeEvent.position, this.players, this.destructionSystem.getWalls());
                // Apply effects to affected players
                for (const affectedPlayer of flashEffect.affectedPlayers) {
                    const player = this.players.get(affectedPlayer.playerId);
                    if (player) {
                        this.flashbangEffectSystem.applyFlashbangEffect(player, affectedPlayer);
                    }
                }
                // Queue flashbang effect event for frontend
                this.pendingProjectileEvents.push({ type: 'FLASHBANG_EFFECT', data: flashEffect });
                // Flashbang detonated
            }
        }
        // Check projectile collisions
        this.checkProjectileCollisions();
        // Process explosions and queue damage events
        this.processExplosions();
        // Update player positions and sync with physics bodies
        for (const [playerId, player] of this.players) {
            // Apply boundary clamping to player state
            const clampedX = Math.max(constants_1.GAME_CONFIG.PLAYER_SIZE / 2, Math.min(constants_1.GAME_CONFIG.GAME_WIDTH - constants_1.GAME_CONFIG.PLAYER_SIZE / 2, player.transform.position.x));
            const clampedY = Math.max(constants_1.GAME_CONFIG.PLAYER_SIZE / 2, Math.min(constants_1.GAME_CONFIG.GAME_HEIGHT - constants_1.GAME_CONFIG.PLAYER_SIZE / 2, player.transform.position.y));
            if (player.transform.position.x !== clampedX || player.transform.position.y !== clampedY) {
                player.transform.position.x = clampedX;
                player.transform.position.y = clampedY;
            }
            // Sync Matter.js body with player position
            const body = this.playerBodies.get(playerId);
            if (body) {
                matter_js_1.default.Body.setPosition(body, {
                    x: player.transform.position.x,
                    y: player.transform.position.y
                });
            }
            // Update movement state based on velocity
            const speed = Math.sqrt(player.velocity.x * player.velocity.x + player.velocity.y * player.velocity.y);
            if (speed < 10) {
                player.movementState = 'idle';
            }
            // console.log(`🔍 FINAL PLAYER POSITION for ${playerId}: (${player.transform.position.x.toFixed(2)}, ${player.transform.position.y.toFixed(2)}) | velocity=(${player.velocity.x.toFixed(2)}, ${player.velocity.y.toFixed(2)})`);
        }
        // Update vision with new tile-based system (only for alive players)
        if (constants_1.GAME_CONFIG.VISION.ENABLED) {
            for (const [playerId, player] of this.players) {
                if (!player.isAlive)
                    continue;
                // Update vision using raycast for better gap detection
                const visibleTilesSet = this.visionSystem.updatePlayerVisionRaycast(player);
                // Vision data is now handled by polygon system
            }
        }
    }
    // Check projectile collisions
    checkProjectileCollisions() {
        const projectiles = this.projectileSystem.getProjectiles();
        const wallDamageEvents = [];
        for (const projectile of projectiles) {
            // Check player collisions
            const playerCollision = this.projectileSystem.checkPlayerCollision(projectile, this.players);
            if (playerCollision.hit && playerCollision.player) {
                const damageEvent = this.projectileSystem.handlePlayerCollision(projectile, playerCollision.player);
                this.applyPlayerDamage(playerCollision.player, damageEvent.damage, damageEvent.damageType, damageEvent.sourcePlayerId, damageEvent.position);
                // Remove projectile (except grenades which bounce)
                if (projectile.type !== 'grenade') {
                    this.projectileSystem.removeProjectile(projectile.id);
                }
            }
            // Check wall collisions (grenades are now handled in update loop, so this is mainly for rockets)
            const wallCollision = this.projectileSystem.checkWallCollision(projectile, this.destructionSystem.getWalls());
            if (wallCollision.hit && wallCollision.wall && wallCollision.sliceIndex !== undefined) {
                // Skip grenades as they're handled immediately in the update loop
                // Note: This should rarely happen now since grenades bounce in the update loop
                if (projectile.type === 'grenade') {
                    continue;
                }
                const projectileDamageEvent = this.projectileSystem.handleWallCollision(projectile, wallCollision.wall, wallCollision.sliceIndex);
                if (projectileDamageEvent) {
                    const wallDamageResult = this.destructionSystem.applyDamage(wallCollision.wall.id, wallCollision.sliceIndex, projectileDamageEvent.damage);
                    // CRITICAL FIX: Store events for broadcasting
                    if (wallDamageResult) {
                        wallDamageEvents.push({ type: constants_1.EVENTS.WALL_DAMAGED, data: wallDamageResult });
                        if (wallDamageResult.isDestroyed) {
                            wallDamageEvents.push({ type: constants_1.EVENTS.WALL_DESTROYED, data: wallDamageResult });
                        }
                        // Notify vision system of wall destruction
                        this.visionSystem.onWallDestroyed(wallCollision.wall.id, wallCollision.wall, wallDamageResult.sliceIndex);
                        // Mark that walls were updated this tick
                        this.wallsUpdatedThisTick = true;
                    }
                }
                // Remove projectile if not a grenade
                if (projectile.type !== 'grenade') {
                    this.projectileSystem.removeProjectile(projectile.id);
                }
            }
        }
        // Store events for later broadcasting
        this.pendingWallDamageEvents = wallDamageEvents;
    }
    // Process explosions and queue damage events
    processExplosions() {
        const explosionResults = this.projectileSystem.processExplosions(this.players, this.destructionSystem.getWalls());
        // Queue player damage events
        for (const damageEvent of explosionResults.playerDamageEvents) {
            // Applying explosion damage
            this.applyPlayerDamage(this.players.get(damageEvent.playerId), damageEvent.damage, damageEvent.damageType, damageEvent.sourcePlayerId, damageEvent.position);
        }
        // Queue wall damage events
        for (const wallDamageEvent of explosionResults.wallDamageEvents) {
            // Actually apply the damage to the wall!
            const actualDamageResult = this.destructionSystem.applyDamage(wallDamageEvent.wallId, wallDamageEvent.sliceIndex, wallDamageEvent.damage);
            if (actualDamageResult) {
                this.pendingWallDamageEvents.push({ type: constants_1.EVENTS.WALL_DAMAGED, data: actualDamageResult });
                if (actualDamageResult.isDestroyed) {
                    this.pendingWallDamageEvents.push({ type: constants_1.EVENTS.WALL_DESTROYED, data: actualDamageResult });
                }
                // Notify vision system of wall destruction
                const wall = this.destructionSystem.getWall(wallDamageEvent.wallId);
                if (wall) {
                    this.visionSystem.onWallDestroyed(wallDamageEvent.wallId, wall, actualDamageResult.sliceIndex);
                }
                // Mark that walls were updated
                this.wallsUpdatedThisTick = true;
            }
        }
        // Queue explosion events
        for (const explosion of explosionResults.explosions) {
            this.pendingProjectileEvents.push({ type: constants_1.EVENTS.EXPLOSION_CREATED, data: explosion });
        }
    }
    // Get pending events that need to be broadcast
    getPendingEvents() {
        const events = [
            ...this.pendingWallDamageEvents,
            ...this.pendingReloadCompleteEvents,
            ...this.pendingProjectileEvents,
            ...this.pendingDeathEvents
        ];
        this.pendingWallDamageEvents = [];
        this.pendingReloadCompleteEvents = [];
        this.pendingProjectileEvents = [];
        this.pendingDeathEvents = [];
        return events;
    }
    getState() {
        // Convert Map to plain object for JSON serialization
        const playersObject = {};
        for (const [id, player] of this.players) {
            // Convert weapons Map to plain object
            const weaponsObject = {};
            for (const [weaponId, weapon] of player.weapons) {
                weaponsObject[weaponId] = weapon;
            }
            playersObject[id] = {
                id: player.id,
                name: player.name, // Include player name
                // CRITICAL: Flatten transform for frontend compatibility
                position: player.transform.position,
                rotation: player.transform.rotation,
                scale: player.transform.scale,
                velocity: player.velocity,
                health: player.isAlive ? player.health : 0, // CRITICAL FIX: Force 0 health when dead
                armor: player.armor,
                team: player.team,
                weaponId: player.weaponId,
                weapons: weaponsObject,
                isAlive: player.isAlive,
                movementState: player.movementState,
                isADS: player.isADS,
                lastDamageTime: player.lastDamageTime,
                kills: player.kills,
                deaths: player.deaths,
                lastProcessedInput: player.lastProcessedInput || 0,
                // Death and respawn fields
                deathTime: player.deathTime,
                respawnTime: player.respawnTime,
                invulnerableUntil: player.invulnerableUntil,
                killerId: player.killerId,
                // Keep transform for backward compatibility
                transform: player.transform
            };
        }
        // Convert walls Map to plain object
        const wallsObject = {};
        for (const [wallId, wall] of this.destructionSystem.getWalls()) {
            wallsObject[wallId] = {
                ...wall,
                destructionMask: Array.from(wall.destructionMask) // Convert Uint8Array to regular array
            };
        }
        return {
            players: playersObject, // Cast to maintain interface compatibility
            walls: wallsObject,
            projectiles: this.projectileSystem.getProjectiles(),
            smokeZones: this.smokeZoneSystem.getSmokeZones(),
            timestamp: Date.now(),
            tickRate: constants_1.GAME_CONFIG.TICK_RATE
        };
    }
    getPlayerBody(playerId) {
        return this.playerBodies.get(playerId);
    }
    // Get weapon system (for external access)
    getWeaponSystem() {
        return this.weaponSystem;
    }
    // Get projectile system (for external access)
    getProjectileSystem() {
        return this.projectileSystem;
    }
    // Get destruction system (for external access)
    getDestructionSystem() {
        return this.destructionSystem;
    }
    /**
     * Find a safe spawn point for late-joining players
     */
    findSafeSpawnPoint(team) {
        // Define spawn points based on team
        const spawnPoints = team === 'red'
            ? [
                { x: 50, y: 50 }, // Top-left area
                { x: 100, y: 50 },
                { x: 50, y: 100 }
            ]
            : [
                { x: 430, y: 220 }, // Bottom-right area
                { x: 380, y: 220 },
                { x: 430, y: 170 }
            ];
        // Get all alive enemies
        const enemies = Object.values(this.players).filter(p => p.team !== team && p.isAlive);
        // If no enemies, return default spawn
        if (enemies.length === 0) {
            return spawnPoints[0];
        }
        // Find spawn point furthest from all enemies
        let bestSpawn = spawnPoints[0];
        let maxMinDistance = 0;
        for (const spawn of spawnPoints) {
            // Calculate minimum distance to any enemy
            let minDistance = Infinity;
            for (const enemy of enemies) {
                const distance = Math.hypot(spawn.x - enemy.transform.position.x, spawn.y - enemy.transform.position.y);
                minDistance = Math.min(minDistance, distance);
            }
            // Track the spawn with the maximum "minimum distance" (furthest from nearest enemy)
            if (minDistance > maxMinDistance) {
                maxMinDistance = minDistance;
                bestSpawn = spawn;
            }
        }
        // Found safe spawn
        return bestSpawn;
    }
    // Get filtered game state for a specific player based on vision
    getFilteredGameState(playerId) {
        // Vision can be disabled via config
        const player = this.players.get(playerId);
        if (!player) {
            // Return minimal state if no player
            return {
                players: {},
                projectiles: [],
                walls: {},
                smokeZones: [],
                timestamp: Date.now(),
                tickRate: constants_1.GAME_CONFIG.TICK_RATE
            };
        }
        // Return all players (vision filtering disabled or not implemented)
        const visiblePlayersObject = {};
        // 🎨 DEBUG: Track team data being sent
        let teamDataDebugLog = `🎨 Game state for ${playerId.substring(0, 8)} - Team data:`;
        // Include all players (alive and dead - dead players shown as corpses/ghosts)
        for (const [pid, p] of this.players) {
            const weaponsObject = {};
            for (const [weaponId, weapon] of p.weapons) {
                weaponsObject[weaponId] = weapon;
            }
            visiblePlayersObject[pid] = {
                id: p.id,
                name: p.name, // Include player name
                // CRITICAL: Flatten transform for frontend compatibility
                position: p.transform.position,
                rotation: p.transform.rotation,
                scale: p.transform.scale,
                velocity: p.velocity,
                health: p.isAlive ? p.health : 0, // CRITICAL FIX: Force 0 health when dead
                armor: p.armor,
                team: p.team,
                weaponId: p.weaponId,
                weapons: weaponsObject,
                isAlive: p.isAlive,
                movementState: p.movementState,
                isADS: p.isADS,
                lastDamageTime: p.lastDamageTime,
                kills: p.kills,
                deaths: p.deaths,
                lastProcessedInput: p.lastProcessedInput || 0,
                // Death and respawn fields
                deathTime: p.deathTime,
                respawnTime: p.respawnTime,
                invulnerableUntil: p.invulnerableUntil,
                killerId: p.killerId,
                // Keep transform for backward compatibility
                transform: p.transform
            };
            // 🎨 DEBUG: Add to team data log
            teamDataDebugLog += ` ${pid.substring(0, 8)}=${p.team}`;
        }
        // 🎨 DEBUG: Log team data every 100th update to avoid spam
        if (Math.random() < 0.01) { // 1% chance to log
            // Team data logged
        }
        // Return all projectiles (vision filtering disabled or not implemented)
        const allProjectiles = this.projectileSystem.getProjectiles();
        const visibleProjectiles = allProjectiles;
        // Get all walls (client will handle vision masking) - convert to plain object
        const wallsObject = {};
        for (const [wallId, wall] of this.destructionSystem.getWalls()) {
            wallsObject[wallId] = {
                ...wall,
                destructionMask: Array.from(wall.destructionMask)
            };
        }
        // Debug smoke zones
        const smokeZones = this.smokeZoneSystem.getSmokeZones();
        if (smokeZones.length > 0) {
            // Including smoke zones in game state
        }
        return {
            players: visiblePlayersObject,
            visiblePlayers: visiblePlayersObject, // Frontend compatibility: send both formats
            projectiles: visibleProjectiles,
            walls: wallsObject,
            smokeZones: smokeZones, // Include smoke zones for rendering
            timestamp: Date.now(),
            tickRate: constants_1.GAME_CONFIG.TICK_RATE,
            // Include polygon vision data
            vision: player ? (() => {
                if (constants_1.GAME_CONFIG.VISION.ENABLED) {
                    // Normal vision system
                    const visionData = this.visionSystem.getVisibilityData(player);
                    return {
                        type: 'polygon',
                        polygon: visionData.polygon,
                        viewAngle: visionData.viewAngle,
                        viewDirection: visionData.viewDirection,
                        viewDistance: visionData.viewDistance,
                        position: player.transform.position,
                        fogOpacity: constants_1.GAME_CONFIG.VISION.FOG_OPACITY
                    };
                }
                else {
                    // Vision disabled - send full map polygon
                    return {
                        type: 'polygon',
                        polygon: [
                            { x: 0, y: 0 },
                            { x: constants_1.GAME_CONFIG.GAME_WIDTH, y: 0 },
                            { x: constants_1.GAME_CONFIG.GAME_WIDTH, y: constants_1.GAME_CONFIG.GAME_HEIGHT },
                            { x: 0, y: constants_1.GAME_CONFIG.GAME_HEIGHT }
                        ],
                        viewAngle: Math.PI * 2, // Full 360 degrees
                        viewDirection: 0,
                        viewDistance: Math.max(constants_1.GAME_CONFIG.GAME_WIDTH, constants_1.GAME_CONFIG.GAME_HEIGHT),
                        position: player.transform.position,
                        fogOpacity: 0 // No fog when vision is disabled
                    };
                }
            })() : undefined
        };
    }
    // Get full game state (for spectators or debugging)
    getFullGameState() {
        return this.getState();
    }
}
exports.GameStateSystem = GameStateSystem;
