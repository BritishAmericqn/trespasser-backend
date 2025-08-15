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
    // Multi-lobby support properties
    gameMode = 'deathmatch';
    mapName = 'yourmap2';
    isPrivateRoom = false;
    password;
    maxPlayers = 8;
    status = 'waiting';
    createdAt = Date.now();
    lastActivity = Date.now();
    // Victory condition properties
    killTarget = 50;
    matchStartTime;
    matchEndCallbacks = [];
    playerCountChangeCallbacks = [];
    constructor(id, io) {
        this.id = id;
        this.io = io;
        this.physics = new PhysicsSystem_1.PhysicsSystem();
        this.gameState = new GameStateSystem_1.GameStateSystem(this.physics);
        // Initialize asynchronously
        this.initialize();
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
        console.log(`🕹️ Adding player ${socket.id} to GameRoom ${this.id}`);
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
        // CRITICAL: Log wall data to debug
        if (Object.keys(filteredState.walls).length === 0) {
            console.error(`❌ NO WALLS IN GAME STATE! This is the problem!`);
            console.error(`🧺 GameRoom initialized:`, this.initialized);
            console.error(`🧺 GameRoom status:`, this.status);
        }
        // Debug: Log the event name being used
        console.log(`📡 Using event name: "${constants_1.EVENTS.GAME_STATE}"`);
        // Log the first wall to verify structure
        const wallsAsObject = filteredState.walls;
        const firstWallId = Object.keys(wallsAsObject)[0];
        if (firstWallId) {
            console.log(`🧱 First wall data:`, wallsAsObject[firstWallId]);
        }
        socket.emit(constants_1.EVENTS.GAME_STATE, filteredState);
        // CRITICAL: Send flattened player state for frontend compatibility
        const flattenedPlayerState = {
            id: playerState.id,
            position: playerState.transform.position,
            rotation: playerState.transform.rotation,
            scale: playerState.transform.scale,
            velocity: playerState.velocity,
            health: playerState.health,
            armor: playerState.armor,
            team: playerState.team,
            weaponId: playerState.weaponId,
            weapons: playerState.weapons,
            isAlive: playerState.isAlive,
            movementState: playerState.movementState,
            isADS: playerState.isADS,
            lastDamageTime: playerState.lastDamageTime,
            kills: playerState.kills,
            deaths: playerState.deaths,
            // Keep transform for backward compatibility
            transform: playerState.transform
        };
        // 🎨 DEBUG: Verify team data in PLAYER_JOINED broadcast
        console.log(`🎨 [PLAYER_JOINED] Broadcasting player ${playerState.id.substring(0, 8)} with team: ${flattenedPlayerState.team}`);
        // CRITICAL FIX: Only broadcast to players in THIS lobby, not all players
        this.broadcastToLobby(constants_1.EVENTS.PLAYER_JOINED, flattenedPlayerState);
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
                console.log(`📤 BROADCASTING ${result.events.length} weapon events to ALL players:`);
                // Broadcast all events to players IN THIS LOBBY ONLY
                for (const eventData of result.events) {
                    console.log(`   Event: ${eventData.type} from player ${weaponFireEvent.playerId.substring(0, 8)}`);
                    if (eventData.type === 'weapon:hit') {
                        console.log(`   🎯 HIT EVENT DATA:`, JSON.stringify(eventData.data, null, 2));
                    }
                    // CRITICAL FIX: Only broadcast to this lobby, not all players
                    this.broadcastToLobby(eventData.type, eventData.data);
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
                    // CRITICAL FIX: Only broadcast to this lobby, not all players
                    this.broadcastToLobby(eventData.type, eventData.data);
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
                    // CRITICAL FIX: Only broadcast to this lobby, not all players
                    this.broadcastToLobby(eventData.type, eventData.data);
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
                    // CRITICAL FIX: Only broadcast to this lobby, not all players
                    this.broadcastToLobby(eventData.type, eventData.data);
                }
            }
        });
        // Player join handler - NEW! Receives loadout from frontend after auth
        socket.on('player:join', (data) => {
            console.log(`🎮 Player ${socket.id} joining with loadout:`, data.loadout);
            console.log(`📊 Current game state has ${Object.keys(this.gameState.getPlayers()).length} players`);
            // Prevent duplicate processing
            if (socket._processingJoin) {
                console.log(`⚠️ Ignoring duplicate player:join from ${socket.id}`);
                return;
            }
            socket._processingJoin = true;
            let player = this.gameState.getPlayer(socket.id);
            if (!player) {
                console.error(`❌ Player ${socket.id} not found in game state`);
                console.error(`🔍 Available players:`, Array.from(this.gameState.getPlayers().keys()));
                console.error(`🔍 Players in room:`, Array.from(this.players.keys()));
                console.error(`🔍 Room status:`, this.status);
                // Try to create the player if they're in the room but not in game state
                if (this.players.has(socket.id)) {
                    console.log(`🔧 Player in room but not in game state, creating player...`);
                    player = this.gameState.createPlayer(socket.id);
                    console.log(`✅ Created player in game state: ${player.id}`);
                }
                else {
                    console.error(`💥 Player not in room either - this shouldn't happen!`);
                    return;
                }
            }
            // Player should exist now
            if (!player) {
                console.error(`💥 Still can't find player after creation attempt`);
                return;
            }
            // Set player team
            if (data.loadout.team) {
                const previousTeam = player.team;
                player.team = data.loadout.team;
                // 🎨 DEBUG: Team data logging for frontend
                console.log(`🎨 Player ${socket.id.substring(0, 8)} team assignment:`);
                console.log(`   Previous team: ${previousTeam}`);
                console.log(`   Loadout team: ${data.loadout.team}`);
                console.log(`   Final team: ${player.team}`);
                // 🎨 VALIDATION: Ensure team was set correctly
                if (player.team !== data.loadout.team) {
                    console.error(`❌ Team assignment failed! Expected: ${data.loadout.team}, Actual: ${player.team}`);
                }
                else {
                    console.log(`✅ Team assignment confirmed: ${player.team}`);
                }
                // CRITICAL: Respawn player at correct team spawn after team is set
                this.gameState.respawnPlayerAtTeamSpawn(socket.id);
                // 🎨 VERIFY: Check team after respawn
                const playerAfterRespawn = this.gameState.getPlayer(socket.id);
                if (playerAfterRespawn) {
                    console.log(`🎨 Post-respawn verification: Player ${socket.id.substring(0, 8)} team is still: ${playerAfterRespawn.team}`);
                }
            }
            else {
                console.warn(`⚠️ Player ${socket.id.substring(0, 8)} loadout missing team data - keeping default: ${player.team}`);
            }
            // Automatically equip the loadout weapons
            const weaponSystem = this.gameState.getWeaponSystem();
            // CRITICAL: Clear existing weapons completely to prevent contamination
            player.weapons.clear();
            player.weaponId = ''; // Reset current weapon
            // Equip primary weapon
            if (data.loadout.primary) {
                const config = weaponSystem.getWeaponConfig(data.loadout.primary);
                if (config) {
                    // CRITICAL: Create fresh weapon instance for this player
                    const weapon = weaponSystem.createWeapon(data.loadout.primary, config);
                    player.weapons.set(data.loadout.primary, weapon);
                    player.weaponId = data.loadout.primary; // Set as current weapon
                    console.log(`✅ Equipped primary: ${data.loadout.primary} for ${socket.id.substring(0, 8)}`);
                }
            }
            // Equip secondary weapon
            if (data.loadout.secondary) {
                const config = weaponSystem.getWeaponConfig(data.loadout.secondary);
                if (config) {
                    // CRITICAL: Create fresh weapon instance for this player
                    const weapon = weaponSystem.createWeapon(data.loadout.secondary, config);
                    player.weapons.set(data.loadout.secondary, weapon);
                    console.log(`✅ Equipped secondary: ${data.loadout.secondary} for ${socket.id.substring(0, 8)}`);
                }
            }
            // Equip support weapons
            if (data.loadout.support) {
                for (const supportWeapon of data.loadout.support) {
                    const config = weaponSystem.getWeaponConfig(supportWeapon);
                    if (config) {
                        // CRITICAL: Create fresh weapon instance for this player
                        const weapon = weaponSystem.createWeapon(supportWeapon, config);
                        player.weapons.set(supportWeapon, weapon);
                        console.log(`✅ Equipped support: ${supportWeapon} for ${socket.id.substring(0, 8)}`);
                    }
                }
            }
            // Send confirmation
            socket.emit('weapon:equipped', {
                weapons: Array.from(player.weapons.keys()),
                currentWeapon: player.weaponId
            });
            // CRITICAL: Send updated game state with vision data
            console.log(`📤 Sending updated game state with vision to ${socket.id}`);
            const updatedState = this.gameState.getFilteredGameState(socket.id);
            console.log(`📤 Vision enabled: ${!!updatedState.vision}, Players: ${Object.keys(updatedState.players).length}, Walls: ${Object.keys(updatedState.walls).length}, VisiblePlayers: ${Object.keys(updatedState.visiblePlayers || {}).length}`);
            console.log(`📤 Event name being sent: '${constants_1.EVENTS.GAME_STATE}'`);
            // CRITICAL DEBUG: Check if walls exist
            if (Object.keys(updatedState.walls).length === 0) {
                console.error(`❌ CRITICAL: No walls in game state during player:join!`);
                console.error(`🧺 GameRoom initialized: ${this.initialized}`);
                console.error(`🧺 GameRoom status: ${this.status}`);
                // Force send a state request to check
                const testState = this.gameState.getState();
                console.error(`🧺 Full game state walls: ${Object.keys(testState.walls).length}`);
            }
            socket.emit(constants_1.EVENTS.GAME_STATE, updatedState);
            console.log(`✅ game:state event sent with ${Object.keys(updatedState.walls).length} walls`);
            // Clear the processing flag
            socket._processingJoin = false;
            console.log(`✅ Player ${socket.id} join processing complete`);
        });
        // Handle explicit game state requests from frontend
        socket.on('request_game_state', () => {
            console.log(`📥 Player ${socket.id} requested game state`);
            const filteredState = this.gameState.getFilteredGameState(socket.id);
            console.log(`📤 Sending requested game state: ${Object.keys(filteredState.players).length} players, ${Object.keys(filteredState.walls).length} walls`);
            socket.emit(constants_1.EVENTS.GAME_STATE, filteredState);
        });
        // Weapon equip handler - for when players select weapons before match
        socket.on('weapon:equip', (weaponData) => {
            const player = this.gameState.getPlayer(socket.id);
            if (!player) {
                console.log(`❌ Player not found for weapon:equip from ${socket.id}`);
                return;
            }
            console.log(`🎯 Equipping weapons for ${socket.id.substring(0, 8)}: primary=${weaponData.primary}, secondary=${weaponData.secondary}, support=[${weaponData.support?.join(',')}]`);
            // CRITICAL: Clear existing weapons completely to prevent contamination
            player.weapons.clear();
            player.weaponId = ''; // Reset current weapon
            const weaponSystem = this.gameState.getWeaponSystem();
            // Equip primary weapon
            if (weaponData.primary) {
                const config = weaponSystem.getWeaponConfig(weaponData.primary);
                if (config) {
                    // CRITICAL: Create fresh weapon instance for this player
                    const weapon = weaponSystem.createWeapon(weaponData.primary, config);
                    player.weapons.set(weaponData.primary, weapon);
                    player.weaponId = weaponData.primary; // Set as current weapon
                    console.log(`✅ Equipped primary: ${weaponData.primary} for ${socket.id.substring(0, 8)}`);
                }
            }
            // Equip secondary weapon
            if (weaponData.secondary) {
                const config = weaponSystem.getWeaponConfig(weaponData.secondary);
                if (config) {
                    // CRITICAL: Create fresh weapon instance for this player
                    const weapon = weaponSystem.createWeapon(weaponData.secondary, config);
                    player.weapons.set(weaponData.secondary, weapon);
                    console.log(`✅ Equipped secondary: ${weaponData.secondary} for ${socket.id.substring(0, 8)}`);
                }
            }
            // Equip support weapons
            if (weaponData.support) {
                for (const supportWeapon of weaponData.support) {
                    const config = weaponSystem.getWeaponConfig(supportWeapon);
                    if (config) {
                        // CRITICAL: Create fresh weapon instance for this player
                        const weapon = weaponSystem.createWeapon(supportWeapon, config);
                        player.weapons.set(supportWeapon, weapon);
                        console.log(`✅ Equipped support: ${supportWeapon} for ${socket.id.substring(0, 8)}`);
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
        // Manual respawn handler
        socket.on('player:respawn', () => {
            const player = this.gameState.getPlayer(socket.id);
            if (player && !player.isAlive && player.deathTime) {
                const now = Date.now();
                const timeSinceDeath = now - player.deathTime;
                // Allow respawn after minimum death time
                if (timeSinceDeath >= constants_1.GAME_CONFIG.DEATH.DEATH_CAM_DURATION) {
                    console.log(`🔄 Manual respawn requested by ${socket.id.substring(0, 8)}`);
                    this.gameState.respawnPlayer(socket.id);
                }
                else {
                    const remainingTime = constants_1.GAME_CONFIG.DEATH.DEATH_CAM_DURATION - timeSinceDeath;
                    console.log(`⏰ Respawn denied for ${socket.id.substring(0, 8)} - ${remainingTime}ms remaining`);
                }
            }
        });
        // Debug events (for testing)
        socket.on('debug:repair_walls', async () => {
            await this.gameState.resetWallsFromMap();
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
                        // CRITICAL FIX: Only broadcast to this lobby, not all players
                        this.broadcastToLobby(eventData.type, eventData.data);
                    }
                }
            }
        });
        socket.on('debug:kill_player', () => {
            // Debug command to instantly kill a player for testing death system
            console.log(`💀 DEBUG: Killing player ${socket.id.substring(0, 8)} for testing`);
            this.gameState.debugKillPlayer(socket.id);
        });
        socket.on('debug:verify_team', () => {
            // Debug command to verify team data consistency
            const player = this.gameState.getPlayer(socket.id);
            if (player) {
                console.log(`🎨 [TEAM VERIFICATION] Player ${socket.id.substring(0, 8)}:`);
                console.log(`   Stored team: ${player.team}`);
                console.log(`   Position: (${player.transform.position.x.toFixed(1)}, ${player.transform.position.y.toFixed(1)})`);
                console.log(`   Is alive: ${player.isAlive}`);
                // Send current team data back to client
                socket.emit('debug:team_data', {
                    playerId: socket.id,
                    team: player.team,
                    position: player.transform.position,
                    isAlive: player.isAlive
                });
            }
            else {
                console.error(`❌ Player ${socket.id} not found for team verification`);
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
        // Notify callbacks about player count change
        this.notifyPlayerCountChange();
        this.updateActivity();
        // CRITICAL FIX: Recreate player info for broadcast (flattenedPlayerState is out of scope here)
        const playerInfo = {
            id: socket.id,
            position: playerState.transform.position,
            rotation: playerState.transform.rotation,
            health: playerState.health,
            team: playerState.team,
            kills: playerState.kills,
            deaths: playerState.deaths,
            isAlive: playerState.isAlive
        };
        // Broadcast player join to ALL players in lobby
        // MUST match frontend's expected structure exactly
        this.broadcastToLobby('player_joined_lobby', {
            lobbyId: this.id,
            playerCount: this.players.size, // Top-level field as frontend expects
            playerId: socket.id,
            timestamp: Date.now()
        });
    }
    removePlayer(playerId) {
        this.players.delete(playerId);
        this.gameState.removePlayer(playerId);
        // CRITICAL FIX: Broadcast to lobby room only, not globally
        this.broadcastToLobby(constants_1.EVENTS.PLAYER_LEFT, {
            playerId
        });
        // Broadcast player left event with frontend's expected structure
        this.broadcastToLobby('player_left_lobby', {
            lobbyId: this.id,
            playerCount: this.players.size, // Top-level field as frontend expects
            playerId: playerId,
            timestamp: Date.now()
        });
        // Notify callbacks about player count change
        this.notifyPlayerCountChange();
        this.updateActivity();
    }
    startGameLoop() {
        this.gameLoopInterval = setInterval(() => {
            this.physics.update(1000 / constants_1.GAME_CONFIG.TICK_RATE);
            this.gameState.update(1000 / constants_1.GAME_CONFIG.TICK_RATE);
            // Check victory condition if match is active
            if (this.status === 'playing') {
                this.checkVictoryCondition();
            }
            // CRITICAL FIX: Broadcast pending wall damage events from projectiles/explosions
            const pendingEvents = this.gameState.getPendingEvents();
            if (pendingEvents.length > 0) {
                // console.log(`📤 Broadcasting ${pendingEvents.length} pending events`);
            }
            for (const event of pendingEvents) {
                // console.log(`📤 Emitting ${event.type}:`, event.data);
                // CRITICAL FIX: Only broadcast to this lobby, not all players
                this.broadcastToLobby(event.type, event.data);
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
    isInitialized() {
        return this.initialized;
    }
    destroy() {
        if (this.gameLoopInterval)
            clearInterval(this.gameLoopInterval);
        if (this.networkInterval)
            clearInterval(this.networkInterval);
        this.physics.destroy();
    }
    // Simple game reset without system recreation
    async resetGame() {
        console.log('🔄 Resetting game state...');
        // Store connected players before reset
        const connectedPlayers = Array.from(this.players.keys());
        // Clear all game state (but keep systems intact)
        await this.gameState.resetAllState();
        // Re-add all players to fresh game state
        connectedPlayers.forEach(playerId => {
            const socket = this.players.get(playerId);
            if (socket && socket.connected) {
                const playerState = this.gameState.createPlayer(playerId);
                // Send fresh initial state to this player
                const filteredState = this.gameState.getFilteredGameState(playerId);
                socket.emit(constants_1.EVENTS.GAME_STATE, filteredState);
                // Broadcast to other players that this player joined
                const flattenedPlayerState = {
                    id: playerState.id,
                    position: playerState.transform.position,
                    rotation: playerState.transform.rotation,
                    scale: playerState.transform.scale,
                    velocity: playerState.velocity,
                    health: playerState.health,
                    armor: playerState.armor,
                    team: playerState.team,
                    weaponId: playerState.weaponId,
                    weapons: {}, // Will be populated when player sends weapon:equip
                    isAlive: playerState.isAlive,
                    movementState: playerState.movementState,
                    isADS: playerState.isADS,
                    lastDamageTime: playerState.lastDamageTime,
                    kills: playerState.kills,
                    deaths: playerState.deaths,
                    transform: playerState.transform
                };
                // CRITICAL FIX: Only broadcast to players in THIS lobby, not all players
                this.broadcastToLobby(constants_1.EVENTS.PLAYER_JOINED, flattenedPlayerState);
            }
        });
        console.log(`✅ Game reset complete! ${connectedPlayers.length} players restored`);
    }
    // ===== MULTI-LOBBY SUPPORT METHODS =====
    getId() {
        return this.id;
    }
    getPlayerCount() {
        return this.players.size;
    }
    getMaxPlayers() {
        return this.maxPlayers;
    }
    setMaxPlayers(max) {
        this.maxPlayers = Math.min(max, parseInt(process.env.MAX_PLAYERS_PER_LOBBY || '8'));
    }
    getGameMode() {
        return this.gameMode;
    }
    setGameMode(mode) {
        this.gameMode = mode;
    }
    getMapName() {
        return this.mapName;
    }
    setMapName(name) {
        this.mapName = name;
    }
    isPrivate() {
        return this.isPrivateRoom;
    }
    setPrivate(isPrivate) {
        this.isPrivateRoom = isPrivate;
    }
    hasPassword() {
        return !!this.password;
    }
    setPassword(password) {
        this.password = password;
        this.isPrivateRoom = true;
    }
    verifyPassword(password) {
        return this.password === password;
    }
    getStatus() {
        return this.status;
    }
    setStatus(status) {
        this.status = status;
        this.lastActivity = Date.now();
    }
    getCreatedAt() {
        return this.createdAt;
    }
    getLastActivity() {
        return this.lastActivity;
    }
    updateActivity() {
        this.lastActivity = Date.now();
    }
    // ===== MATCH MANAGEMENT METHODS =====
    startMatch() {
        this.status = 'playing';
        this.matchStartTime = Date.now();
        this.updateActivity();
        console.log(`🎮 Match started in lobby ${this.id}`);
        // NOTE: match_started event is broadcast by LobbyManager.startMatch()
        // to avoid duplicate events
    }
    resetForNewMatch() {
        this.status = 'waiting';
        this.matchStartTime = undefined;
        this.updateActivity();
        // Reset game state
        this.gameState.resetAllState();
        console.log(`🔄 Lobby ${this.id} reset for new match`);
    }
    checkVictoryCondition() {
        if (this.status !== 'playing')
            return false;
        const players = this.gameState.getPlayers();
        let redKills = 0;
        let blueKills = 0;
        // Calculate team kill counts
        for (const [playerId, playerState] of players) {
            if (playerState.team === 'red') {
                redKills += playerState.kills;
            }
            else if (playerState.team === 'blue') {
                blueKills += playerState.kills;
            }
        }
        // Check if any team reached the kill target
        if (redKills >= this.killTarget || blueKills >= this.killTarget) {
            this.endMatch(redKills, blueKills);
            return true;
        }
        return false;
    }
    endMatch(redKills, blueKills) {
        const winnerTeam = redKills >= this.killTarget ? 'red' : 'blue';
        const matchDuration = this.matchStartTime ? Date.now() - this.matchStartTime : 0;
        this.status = 'finished';
        this.updateActivity();
        // Gather player statistics
        const playerStats = [];
        for (const [playerId, playerState] of this.gameState.getPlayers()) {
            playerStats.push({
                playerId: playerId,
                playerName: `Player ${playerId.substring(0, 8)}`, // TODO: Add player names to PlayerState
                team: playerState.team,
                kills: playerState.kills,
                deaths: playerState.deaths,
                damageDealt: 0 // TODO: Add damage tracking to PlayerState
            });
        }
        const matchData = {
            lobbyId: this.id,
            winnerTeam,
            redKills,
            blueKills,
            duration: matchDuration,
            playerStats
        };
        console.log(`🏁 Match ended in lobby ${this.id} - Winner: ${winnerTeam} (${redKills} vs ${blueKills} kills)`);
        // Broadcast match end to all players in lobby
        this.broadcastToLobby('match_ended', matchData);
        // Trigger match end callbacks
        this.matchEndCallbacks.forEach(callback => {
            try {
                callback(matchData);
            }
            catch (error) {
                console.error('Error in match end callback:', error);
            }
        });
    }
    // ===== EVENT BROADCASTING METHODS =====
    broadcastToLobby(event, data) {
        this.io.to(this.id).emit(event, data);
    }
    // Get comprehensive lobby state for broadcasting
    getLobbyState() {
        const players = Array.from(this.players.keys()).map(id => {
            const player = this.gameState.getPlayer(id);
            if (!player)
                return null;
            return {
                id,
                health: player.health,
                team: player.team,
                kills: player.kills,
                deaths: player.deaths,
                isAlive: player.isAlive
            };
        }).filter(p => p !== null);
        return {
            lobbyId: this.id,
            playerCount: this.players.size,
            maxPlayers: this.maxPlayers,
            players,
            status: this.status,
            minimumPlayers: 2,
            gameMode: this.gameMode,
            mapName: this.mapName,
            matchStartTime: this.matchStartTime
        };
    }
    // Broadcast the current lobby state to all players
    broadcastLobbyState() {
        this.broadcastToLobby('lobby_state_update', this.getLobbyState());
    }
    // ===== CALLBACK REGISTRATION METHODS =====
    onMatchEnd(callback) {
        this.matchEndCallbacks.push(callback);
    }
    onPlayerCountChange(callback) {
        this.playerCountChangeCallbacks.push(callback);
    }
    notifyPlayerCountChange() {
        const count = this.players.size;
        this.playerCountChangeCallbacks.forEach(callback => {
            try {
                callback(count);
            }
            catch (error) {
                console.error('Error in player count change callback:', error);
            }
        });
    }
}
exports.GameRoom = GameRoom;
