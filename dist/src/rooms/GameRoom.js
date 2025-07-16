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
                chargeLevel: event.chargeLevel // Pass through charge level for grenades
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
