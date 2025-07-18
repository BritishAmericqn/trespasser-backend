"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameRoom = void 0;
const PhysicsSystem_1 = require("../systems/PhysicsSystem");
const GameStateSystem_1 = require("../systems/GameStateSystem");
const constants_1 = require("../../shared/constants");
class GameRoom {
    id;
    io;
    players = new Map();
    physics;
    gameState;
    gameLoopInterval;
    networkInterval;
    initialized = false;
    constructor(id, io) {
        this.id = id;
        this.io = io;
        this.physics = new PhysicsSystem_1.PhysicsSystem();
        this.gameState = new GameStateSystem_1.GameStateSystem(this.physics);
        // Initialize asynchronously
        this.initialize();
    }
    isInitialized() {
        return this.initialized;
    }
    getGameState() {
        return this.gameState;
    }
    async initialize() {
        try {
            // Wait for destruction system to load map
            await this.gameState.initialize();
            this.initialized = true;
            console.log('✅ GameRoom initialized with map loaded');
            this.startGameLoop();
        }
        catch (error) {
            console.error('❌ Failed to initialize GameRoom:', error);
        }
    }
    addPlayer(socket) {
        if (!this.initialized) {
            console.warn('⚠️ GameRoom not yet initialized, player connection delayed');
            setTimeout(() => this.addPlayer(socket), 100);
            return;
        }
        // console.log(`🎮 Player ${socket.id} joined the game`);
        this.players.set(socket.id, socket);
        // CRITICAL: Join the socket to this room so they receive broadcasts
        socket.join(this.id);
        const playerState = this.gameState.createPlayer(socket.id);
        // Send initial filtered state to the joining player
        const filteredState = this.gameState.getFilteredGameState(socket.id);
        console.log(`📤 Sending initial game state to ${socket.id}:`, {
            players: Object.keys(filteredState.players).length,
            walls: Object.keys(filteredState.walls).length,
            projectiles: filteredState.projectiles.length
        });
        // Debug: Log the event name being used
        console.log(`📡 Using event name: "${constants_1.EVENTS.GAME_STATE}"`);
        // Log the first wall to verify structure
        const wallsAsObject = filteredState.walls;
        const firstWallId = Object.keys(wallsAsObject)[0];
        if (firstWallId) {
            console.log(`🧱 First wall data:`, wallsAsObject[firstWallId]);
        }
        socket.emit(constants_1.EVENTS.GAME_STATE, filteredState);
        socket.broadcast.emit(constants_1.EVENTS.PLAYER_JOINED, playerState);
        // Player input handling
        socket.on(constants_1.EVENTS.PLAYER_INPUT, (input) => {
            this.gameState.handlePlayerInput(socket.id, input);
        });
        // Weapon events
        socket.on(constants_1.EVENTS.WEAPON_FIRE, (event) => {
            // Get the server's authoritative player position
            const player = this.gameState.getPlayer(socket.id);
            if (!player) {
                return;
            }
            // Use server position and rotation, not client position
            const weaponFireEvent = {
                playerId: socket.id,
                weaponType: event.weaponType,
                position: { ...player.transform.position }, // Use server position
                direction: player.transform.rotation, // Use server rotation, not client!
                isADS: event.isADS,
                timestamp: event.timestamp,
                sequence: event.sequence,
                chargeLevel: event.chargeLevel, // Pass through charge level for grenades
                pelletCount: event.pelletCount // Pass through pellet count for shotgun
            };
            const result = this.gameState.handleWeaponFire(weaponFireEvent);
            if (result.success) {
                // Broadcast all events to all players
                for (const eventData of result.events) {
                    this.io.emit(eventData.type, eventData.data);
                }
            }
        });
        socket.on(constants_1.EVENTS.WEAPON_RELOAD, (event) => {
            // Add playerId to the event data
            const weaponReloadEvent = {
                ...event,
                playerId: socket.id
            };
            const result = this.gameState.handleWeaponReload(weaponReloadEvent.playerId);
            if (result.success) {
                for (const eventData of result.events) {
                    this.io.emit(eventData.type, eventData.data);
                }
            }
        });
        socket.on(constants_1.EVENTS.WEAPON_SWITCH, (event) => {
            // Add playerId to the event data
            const weaponSwitchEvent = {
                ...event,
                playerId: socket.id
            };
            const result = this.gameState.handleWeaponSwitch(weaponSwitchEvent.playerId, weaponSwitchEvent.toWeapon);
            if (result.success) {
                for (const eventData of result.events) {
                    this.io.emit(eventData.type, eventData.data);
                }
            }
        });
        socket.on(constants_1.EVENTS.GRENADE_THROW, (event) => {
            // Add playerId to the event data
            const grenadeThrowEvent = {
                ...event,
                playerId: socket.id
            };
            const result = this.gameState.handleGrenadeThrow(grenadeThrowEvent);
            if (result.success) {
                for (const eventData of result.events) {
                    this.io.emit(eventData.type, eventData.data);
                }
            }
        });
        // Player join handler - NEW! Receives loadout from frontend after auth
        socket.on('player:join', (data) => {
            console.log(`🎮 Player ${socket.id} joining with loadout:`, data.loadout);
            const player = this.gameState.getPlayer(socket.id);
            if (!player) {
                console.error(`❌ Player ${socket.id} not found`);
                return;
            }
            // Set player team
            if (data.loadout.team) {
                player.team = data.loadout.team;
            }
            // Automatically equip the loadout weapons
            const weaponSystem = this.gameState.getWeaponSystem();
            // Clear existing weapons
            player.weapons.clear();
            // Equip primary weapon
            if (data.loadout.primary) {
                const config = weaponSystem.getWeaponConfig(data.loadout.primary);
                if (config) {
                    const weapon = weaponSystem.createWeapon(data.loadout.primary, config);
                    player.weapons.set(data.loadout.primary, weapon);
                    player.weaponId = data.loadout.primary; // Set as current weapon
                    console.log(`✅ Equipped primary: ${data.loadout.primary}`);
                }
            }
            // Equip secondary weapon
            if (data.loadout.secondary) {
                const config = weaponSystem.getWeaponConfig(data.loadout.secondary);
                if (config) {
                    const weapon = weaponSystem.createWeapon(data.loadout.secondary, config);
                    player.weapons.set(data.loadout.secondary, weapon);
                    console.log(`✅ Equipped secondary: ${data.loadout.secondary}`);
                }
            }
            // Equip support weapons
            if (data.loadout.support) {
                for (const supportWeapon of data.loadout.support) {
                    const config = weaponSystem.getWeaponConfig(supportWeapon);
                    if (config) {
                        const weapon = weaponSystem.createWeapon(supportWeapon, config);
                        player.weapons.set(supportWeapon, weapon);
                        console.log(`✅ Equipped support: ${supportWeapon}`);
                    }
                }
            }
            // Send confirmation
            socket.emit('weapon:equipped', {
                weapons: Array.from(player.weapons.keys()),
                currentWeapon: player.weaponId
            });
        });
        // Weapon equip handler - for when players select weapons before match
        socket.on('weapon:equip', (weaponData) => {
            const player = this.gameState.getPlayer(socket.id);
            if (!player)
                return;
            console.log(`🎯 Equipping weapons for ${socket.id}: primary=${weaponData.primary}, secondary=${weaponData.secondary}, support=[${weaponData.support?.join(',')}]`);
            // Clear existing weapons
            player.weapons.clear();
            const weaponSystem = this.gameState.getWeaponSystem();
            // Equip primary weapon
            if (weaponData.primary) {
                const config = weaponSystem.getWeaponConfig(weaponData.primary);
                if (config) {
                    const weapon = weaponSystem.createWeapon(weaponData.primary, config);
                    player.weapons.set(weaponData.primary, weapon);
                    player.weaponId = weaponData.primary; // Set as current weapon
                    console.log(`✅ Equipped primary: ${weaponData.primary}`);
                }
            }
            // Equip secondary weapon
            if (weaponData.secondary) {
                const config = weaponSystem.getWeaponConfig(weaponData.secondary);
                if (config) {
                    const weapon = weaponSystem.createWeapon(weaponData.secondary, config);
                    player.weapons.set(weaponData.secondary, weapon);
                    console.log(`✅ Equipped secondary: ${weaponData.secondary}`);
                }
            }
            // Equip support weapons
            if (weaponData.support) {
                for (const supportWeapon of weaponData.support) {
                    const config = weaponSystem.getWeaponConfig(supportWeapon);
                    if (config) {
                        const weapon = weaponSystem.createWeapon(supportWeapon, config);
                        player.weapons.set(supportWeapon, weapon);
                        console.log(`✅ Equipped support: ${supportWeapon}`);
                    }
                }
            }
            // Send confirmation
            socket.emit('weapon:equipped', {
                weapons: Array.from(player.weapons.keys()),
                currentWeapon: player.weaponId
            });
        });
        // Legacy events (keeping for compatibility)
        socket.on(constants_1.EVENTS.PLAYER_SHOOT, (data) => {
            this.gameState.handlePlayerShoot(socket.id, data);
        });
        socket.on('disconnect', () => {
            // console.log(`👋 Player ${socket.id} left the game`);
            this.removePlayer(socket.id);
        });
        // Debug events (for testing)
        socket.on('debug:repair_walls', () => {
            this.gameState.getDestructionSystem().resetAllWalls();
            // console.log('🔧 All walls repaired');
        });
        socket.on('debug:destruction_stats', () => {
            const stats = this.gameState.getDestructionSystem().getDestructionStats();
            // console.log('📊 Destruction stats:', stats);
            socket.emit('debug:destruction_stats', stats);
        });
        socket.on('debug:clear_projectiles', () => {
            this.gameState.getProjectileSystem().clear();
            // console.log('🧹 All projectiles cleared');
        });
        socket.on('debug:give_weapon', (weaponType) => {
            const player = this.gameState.getPlayer(socket.id);
            if (player && weaponType) {
                const weaponSystem = this.gameState.getWeaponSystem();
                const config = weaponSystem.getWeaponConfig(weaponType);
                if (config) {
                    const weapon = weaponSystem.createWeapon(weaponType, config);
                    player.weapons.set(weaponType, weapon);
                    player.weaponId = weaponType;
                    console.log(`🎁 Gave ${weaponType} to player ${socket.id.substring(0, 8)}`);
                    // Send weapon equipped event
                    socket.emit('weapon:equipped', {
                        weaponType: weaponType,
                        weapon: weapon
                    });
                }
            }
        });
        socket.on('debug:throw_grenade', () => {
            // Debug command to manually throw a grenade
            const throwPlayer = this.gameState.getPlayer(socket.id);
            if (throwPlayer) {
                const grenadeThrowEvent = {
                    playerId: socket.id,
                    position: { ...throwPlayer.transform.position },
                    direction: throwPlayer.transform.rotation,
                    chargeLevel: 3,
                    timestamp: Date.now()
                };
                console.log(`🎯 DEBUG: Throwing grenade for player ${socket.id}`);
                const throwResult = this.gameState.handleGrenadeThrow(grenadeThrowEvent);
                if (throwResult.success) {
                    for (const eventData of throwResult.events) {
                        this.io.emit(eventData.type, eventData.data);
                    }
                }
            }
        });
        // Listen for any events for debugging
        socket.onAny((eventName, ...args) => {
            if (!eventName.includes('player:input') &&
                !eventName.includes('ping') &&
                !eventName.includes('pong')) {
                // Removed debug logging
            }
        });
    }
    removePlayer(playerId) {
        this.players.delete(playerId);
        this.gameState.removePlayer(playerId);
        this.io.emit(constants_1.EVENTS.PLAYER_LEFT, { playerId });
    }
    startGameLoop() {
        this.gameLoopInterval = setInterval(() => {
            this.physics.update(1000 / constants_1.GAME_CONFIG.TICK_RATE);
            this.gameState.update(1000 / constants_1.GAME_CONFIG.TICK_RATE);
            // CRITICAL FIX: Broadcast pending wall damage events from projectiles/explosions
            const pendingEvents = this.gameState.getPendingEvents();
            if (pendingEvents.length > 0) {
                // console.log(`📤 Broadcasting ${pendingEvents.length} pending events`);
            }
            for (const event of pendingEvents) {
                // console.log(`📤 Emitting ${event.type}:`, event.data);
                this.io.emit(event.type, event.data);
            }
        }, 1000 / constants_1.GAME_CONFIG.TICK_RATE);
        this.networkInterval = setInterval(() => {
            // Send filtered game state to each player based on their vision
            for (const [playerId, socket] of this.players) {
                const filteredState = this.gameState.getFilteredGameState(playerId);
                // Debug logging removed - was causing console spam
                if (!socket.connected) {
                    console.warn(`⚠️ Socket ${playerId} is disconnected but still in players map!`);
                    continue;
                }
                socket.emit(constants_1.EVENTS.GAME_STATE, filteredState);
            }
        }, 1000 / constants_1.GAME_CONFIG.NETWORK_RATE);
    }
    destroy() {
        if (this.gameLoopInterval)
            clearInterval(this.gameLoopInterval);
        if (this.networkInterval)
            clearInterval(this.networkInterval);
        this.physics.destroy();
    }
}
exports.GameRoom = GameRoom;
