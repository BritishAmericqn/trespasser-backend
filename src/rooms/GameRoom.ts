import { Socket, Server } from 'socket.io';
import { GameState, PlayerState, WeaponFireEvent, WeaponReloadEvent, WeaponSwitchEvent, GrenadeThrowEvent } from '../../shared/types';
import { PhysicsSystem } from '../systems/PhysicsSystem';
import { GameStateSystem } from '../systems/GameStateSystem';
import { EVENTS, GAME_CONFIG } from '../../shared/constants';

export class GameRoom {
  private id: string;
  private io: Server;
  private players: Map<string, Socket> = new Map();
  private physics: PhysicsSystem;
  private gameState: GameStateSystem;
  private gameLoopInterval?: NodeJS.Timeout;
  private networkInterval?: NodeJS.Timeout;
  private initialized: boolean = false;
  
  // Multi-lobby support properties
  private gameMode: string = 'deathmatch';
  private mapName: string = 'yourmap2';
  private isPrivateRoom: boolean = false;
  private password?: string;
  private maxPlayers: number = 8;
  private status: 'waiting' | 'playing' | 'finished' = 'waiting';
  private createdAt: number = Date.now();
  private lastActivity: number = Date.now();
  
  // Victory condition properties
  private killTarget: number = 50;
  private matchStartTime?: number;
  private matchEndCallbacks: Array<(matchData: any) => void> = [];
  private playerCountChangeCallbacks: Array<(count: number) => void> = [];
  
  constructor(id: string, io: Server) {
    this.id = id;
    this.io = io;
    this.physics = new PhysicsSystem();
    this.gameState = new GameStateSystem(this.physics);
    
    // Initialize asynchronously
    this.initialize();
  }
  
  getGameState(): GameStateSystem {
    return this.gameState;
  }
  
  private async initialize(): Promise<void> {
    try {
      // Wait for destruction system to load map
      await this.gameState.initialize();
      this.initialized = true;
      console.log('✅ GameRoom initialized with map loaded');
      this.startGameLoop();
    } catch (error) {
      console.error('❌ Failed to initialize GameRoom:', error);
      
      // RAILWAY FIX: Set initialized to true even on map loading failure
      // This prevents the room from being stuck in uninitialized state
      // The DestructionSystem already falls back to test walls on map loading failure
      this.initialized = true;
      console.log('⚠️ GameRoom initialized with fallback configuration (test walls)');
      this.startGameLoop();
      
      // Log error details for Railway debugging
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage?.includes('ENOENT') || errorMessage?.includes('map')) {
        console.error(`   💡 Map loading failed in Railway - this is expected if MAP_FILE is set but maps/ folder not accessible`);
        console.error(`   💡 Recommendation: Don't set MAP_FILE environment variable in Railway to use test walls`);
      }
    }
  }
  
  addPlayer(socket: Socket): void {
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
    
    // Handle late joiners to games in progress
    if (this.status === 'playing') {
      console.log(`⚡ Player ${socket.id} joining game in progress`);
      
      // CRITICAL: Debug late joiner registration
      console.log(`🔍 Late joiner status:`, {
        socketId: socket.id,
        hasPlayer: !!this.gameState.getPlayer(socket.id),
        isInPlayersMap: this.players.has(socket.id),
        gameStatus: this.status
      });
      
      // Send match_started event so they know game is active
      socket.emit('match_started', {
        lobbyId: this.id,
        startTime: this.matchStartTime,
        killTarget: this.killTarget,
        isLateJoin: true
      });
      
      // Find safe spawn point away from enemies
      const safeSpawn = this.gameState.findSafeSpawnPoint(playerState.team);
      if (safeSpawn) {
        playerState.transform.position = safeSpawn;
        console.log(`🛡️ Late joiner ${socket.id} spawned at safe location:`, safeSpawn);
      }
      
      // Give brief spawn protection (3 seconds)
      (playerState as any).spawnProtection = 3000;
      (playerState as any).spawnProtectionStart = Date.now();
      console.log(`🛡️ Late joiner ${socket.id} given 3 seconds spawn protection`);
    }
    
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
    console.log(`📡 Using event name: "${EVENTS.GAME_STATE}"`);
    
    // Log the first wall to verify structure
    const wallsAsObject = filteredState.walls as any;
    const firstWallId = Object.keys(wallsAsObject)[0];
    if (firstWallId) {
      console.log(`🧱 First wall data:`, wallsAsObject[firstWallId]);
    }
    
    socket.emit(EVENTS.GAME_STATE, filteredState);
    
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
    this.broadcastToLobby(EVENTS.PLAYER_JOINED, flattenedPlayerState);
    
    // Player input handling
    socket.on(EVENTS.PLAYER_INPUT, (input) => {
      this.gameState.handlePlayerInput(socket.id, input);
    });
    
    // Weapon events
    socket.on(EVENTS.WEAPON_FIRE, (event: any) => {
      // Get the server's authoritative player position
      const player = this.gameState.getPlayer(socket.id);
      if (!player) {
        return;
      }
      
      // Use server position and rotation, not client position
      const weaponFireEvent: WeaponFireEvent = {
        playerId: socket.id,
        weaponType: event.weaponType,
        position: { ...player.transform.position }, // Use server position
        direction: player.transform.rotation,        // Use server rotation, not client!
        isADS: event.isADS,
        timestamp: event.timestamp,
        sequence: event.sequence,
        chargeLevel: event.chargeLevel,             // Pass through charge level for grenades
        pelletCount: event.pelletCount              // Pass through pellet count for shotgun
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
    
    socket.on(EVENTS.WEAPON_RELOAD, (event: any) => {
      // Add playerId to the event data
      const weaponReloadEvent: WeaponReloadEvent = {
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
    
    socket.on(EVENTS.WEAPON_SWITCH, (event: any) => {
      // Add playerId to the event data
      const weaponSwitchEvent: WeaponSwitchEvent = {
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
    
    socket.on(EVENTS.GRENADE_THROW, (event: any) => {
      // Add playerId to the event data
      const grenadeThrowEvent: GrenadeThrowEvent = {
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
    socket.on('player:join', (data: { loadout: { primary: string; secondary: string; support: string[]; team: string }, playerName?: string, timestamp: number }) => {
      console.log(`🎮 Player ${socket.id} joining with loadout:`, data.loadout);
      console.log(`📊 Current game state has ${Object.keys(this.gameState.getPlayers()).length} players`);
      
      // Prevent duplicate processing
      if ((socket as any)._processingJoin) {
        console.log(`⚠️ Ignoring duplicate player:join from ${socket.id}`);
        return;
      }
      (socket as any)._processingJoin = true;
      
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
        } else {
          console.error(`💥 Player not in room either - this shouldn't happen!`);
          socket.emit('player:join:failed', {
            reason: 'Player not in game room',
            gameStatus: this.status,
            timestamp: Date.now()
          });
          (socket as any)._processingJoin = false;
          return;
        }
      }
      
      // Player should exist now
      if (!player) {
        console.error(`💥 Still can't find player after creation attempt`);
        socket.emit('player:join:failed', {
          reason: 'Could not create player in game state',
          gameStatus: this.status,
          timestamp: Date.now()
        });
        (socket as any)._processingJoin = false;
        return;
      }
      
      // Set player name if provided
      if (data.playerName) {
        player.name = data.playerName;
        console.log(`👤 Player ${socket.id.substring(0, 8)} name set to: ${data.playerName}`);
      } else {
        // Generate a default name if none provided
        player.name = `Player ${socket.id.substring(0, 8)}`;
        console.log(`👤 Player ${socket.id.substring(0, 8)} using generated name: ${player.name}`);
      }
      
      // Set player team
      if (data.loadout.team) {
        const previousTeam = player.team;
        player.team = data.loadout.team as 'red' | 'blue';
        
        // 🎨 DEBUG: Team data logging for frontend
        console.log(`🎨 Player ${socket.id.substring(0, 8)} team assignment:`);
        console.log(`   Previous team: ${previousTeam}`);
        console.log(`   Loadout team: ${data.loadout.team}`);
        console.log(`   Final team: ${player.team}`);
        
        // 🎨 VALIDATION: Ensure team was set correctly
        if (player.team !== data.loadout.team) {
          console.error(`❌ Team assignment failed! Expected: ${data.loadout.team}, Actual: ${player.team}`);
        } else {
          console.log(`✅ Team assignment confirmed: ${player.team}`);
        }
        
        // CRITICAL: Respawn player at correct team spawn after team is set
        this.gameState.respawnPlayerAtTeamSpawn(socket.id);
        
        // 🎨 VERIFY: Check team after respawn
        const playerAfterRespawn = this.gameState.getPlayer(socket.id);
        if (playerAfterRespawn) {
          console.log(`🎨 Post-respawn verification: Player ${socket.id.substring(0, 8)} team is still: ${playerAfterRespawn.team}`);
        }
      } else {
        console.warn(`⚠️ Player ${socket.id.substring(0, 8)} loadout missing team data - keeping default: ${player.team}`);
      }
      
      // Automatically equip the loadout weapons
      const weaponSystem = this.gameState.getWeaponSystem();
      
      // CRITICAL: Clear existing weapons completely to prevent contamination
      player.weapons.clear();
      player.weaponId = ''; // Reset current weapon
      
      // Equip primary weapon
      if (data.loadout.primary) {
        const config = weaponSystem.getWeaponConfig(data.loadout.primary as any);
        if (config) {
          // CRITICAL: Create fresh weapon instance for this player
          const weapon = weaponSystem.createWeapon(data.loadout.primary as any, config);
          player.weapons.set(data.loadout.primary, weapon);
          player.weaponId = data.loadout.primary; // Set as current weapon
          console.log(`✅ Equipped primary: ${data.loadout.primary} for ${socket.id.substring(0, 8)}`);
        }
      }
      
      // Equip secondary weapon
      if (data.loadout.secondary) {
        const config = weaponSystem.getWeaponConfig(data.loadout.secondary as any);
        if (config) {
          // CRITICAL: Create fresh weapon instance for this player
          const weapon = weaponSystem.createWeapon(data.loadout.secondary as any, config);
          player.weapons.set(data.loadout.secondary, weapon);
          console.log(`✅ Equipped secondary: ${data.loadout.secondary} for ${socket.id.substring(0, 8)}`);
        }
      }
      
      // Equip support weapons
      if (data.loadout.support) {
        for (const supportWeapon of data.loadout.support) {
          const config = weaponSystem.getWeaponConfig(supportWeapon as any);
          if (config) {
            // CRITICAL: Create fresh weapon instance for this player
            const weapon = weaponSystem.createWeapon(supportWeapon as any, config);
            player.weapons.set(supportWeapon, weapon);
            console.log(`✅ Equipped support: ${supportWeapon} for ${socket.id.substring(0, 8)}`);
          }
        }
      }
      
      // Send confirmation
      console.log(`🔫 Weapons equipped for ${socket.id.substring(0, 8)}:`, {
        weapons: Array.from(player.weapons.keys()),
        currentWeapon: player.weaponId,
        weaponCount: player.weapons.size
      });
      socket.emit('weapon:equipped', {
        weapons: Array.from(player.weapons.keys()),
        currentWeapon: player.weaponId
      });
      
      // CRITICAL: Send explicit join success confirmation
      socket.emit('player:join:success', {
        playerId: socket.id,
        team: player.team,
        isActive: true,
        gameStatus: this.status,
        timestamp: Date.now()
      });
      console.log(`✅ Sent player:join:success confirmation to ${socket.id}`);
      
      // CRITICAL: Send updated game state with vision data
      console.log(`📤 Sending updated game state with vision to ${socket.id}`);
      const updatedState = this.gameState.getFilteredGameState(socket.id);
      console.log(`📤 Vision enabled: ${!!updatedState.vision}, Players: ${Object.keys(updatedState.players).length}, Walls: ${Object.keys(updatedState.walls).length}, VisiblePlayers: ${Object.keys(updatedState.visiblePlayers || {}).length}`);
      console.log(`📤 Event name being sent: '${EVENTS.GAME_STATE}'`);
      
      // CRITICAL DEBUG: Check if walls exist
      if (Object.keys(updatedState.walls).length === 0) {
        console.error(`❌ CRITICAL: No walls in game state during player:join!`);
        console.error(`🧺 GameRoom initialized: ${this.initialized}`);
        console.error(`🧺 GameRoom status: ${this.status}`);
        // Force send a state request to check
        const testState = this.gameState.getState();
        console.error(`🧺 Full game state walls: ${Object.keys(testState.walls).length}`);
      }
      
      socket.emit(EVENTS.GAME_STATE, updatedState);
      console.log(`✅ game:state event sent with ${Object.keys(updatedState.walls).length} walls`);
      
      // Clear the processing flag
      (socket as any)._processingJoin = false;
      console.log(`✅ Player ${socket.id} join processing complete`);
    });
    
    // Handle explicit game state requests from frontend
    socket.on('request_game_state', () => {
      console.log(`📥 Player ${socket.id} requested game state`);
      const filteredState = this.gameState.getFilteredGameState(socket.id);
      console.log(`📤 Sending requested game state: ${Object.keys(filteredState.players).length} players, ${Object.keys(filteredState.walls).length} walls`);
      socket.emit(EVENTS.GAME_STATE, filteredState);
    });
    
    // Weapon equip handler - for when players select weapons before match
    socket.on('weapon:equip', (weaponData: { primary?: string, secondary?: string, support?: string[] }) => {
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
        const config = weaponSystem.getWeaponConfig(weaponData.primary as any);
        if (config) {
          // CRITICAL: Create fresh weapon instance for this player
          const weapon = weaponSystem.createWeapon(weaponData.primary as any, config);
          player.weapons.set(weaponData.primary, weapon);
          player.weaponId = weaponData.primary; // Set as current weapon
          console.log(`✅ Equipped primary: ${weaponData.primary} for ${socket.id.substring(0, 8)}`);
        }
      }
      
      // Equip secondary weapon
      if (weaponData.secondary) {
        const config = weaponSystem.getWeaponConfig(weaponData.secondary as any);
        if (config) {
          // CRITICAL: Create fresh weapon instance for this player
          const weapon = weaponSystem.createWeapon(weaponData.secondary as any, config);
          player.weapons.set(weaponData.secondary, weapon);
          console.log(`✅ Equipped secondary: ${weaponData.secondary} for ${socket.id.substring(0, 8)}`);
        }
      }
      
      // Equip support weapons
      if (weaponData.support) {
        for (const supportWeapon of weaponData.support) {
          const config = weaponSystem.getWeaponConfig(supportWeapon as any);
          if (config) {
            // CRITICAL: Create fresh weapon instance for this player
            const weapon = weaponSystem.createWeapon(supportWeapon as any, config);
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
    socket.on(EVENTS.PLAYER_SHOOT, (data) => {
      this.gameState.handlePlayerShoot(socket.id, data);
    });
    
    socket.on('disconnect', () => {
      // console.log(`👋 Player ${socket.id} left the game`);
      this.removePlayer(socket.id);
    });
    
    // Manual respawn handler - CRITICAL FIX: Complete rewrite
    socket.on('player:respawn', () => {
      const player = this.gameState.getPlayer(socket.id);
      if (!player || player.isAlive) {
        console.log(`⚠️ Invalid respawn request from ${socket.id} - player alive or not found`);
        return;
      }
      
      if (!player.deathTime) {
        console.log(`⚠️ Invalid respawn request from ${socket.id} - no death time recorded`);
        return;
      }
      
      const now = Date.now();
      const timeSinceDeath = now - player.deathTime;
      
      // Allow respawn after minimum death time
      if (timeSinceDeath >= GAME_CONFIG.DEATH.DEATH_CAM_DURATION) {
        console.log(`🔄 Manual respawn requested by ${socket.id.substring(0, 8)}`);
        
        // Respawn the player and get respawn data
        const respawnData = this.gameState.respawnPlayer(socket.id);
        
        // CRITICAL FIX: Send respawn event immediately
        if (respawnData) {
          // Send to requesting client
          socket.emit('backend:player:respawned', respawnData);
          
          // Broadcast to other players in lobby
          socket.broadcast.to(this.id).emit('backend:player:respawned', respawnData);
          
          console.log(`✅ Respawn event sent for ${socket.id.substring(0, 8)} at position (${respawnData.position.x}, ${respawnData.position.y})`);
        }
      } else {
        const remainingTime = GAME_CONFIG.DEATH.DEATH_CAM_DURATION - timeSinceDeath;
        console.log(`⏰ Respawn denied for ${socket.id.substring(0, 8)} - ${remainingTime}ms remaining`);
        
        // CRITICAL FIX: Send denial response to client
        socket.emit('backend:respawn:denied', {
          remainingTime: remainingTime,
          timestamp: now
        });
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
    
    socket.on('debug:give_weapon', (weaponType: string) => {
      const player = this.gameState.getPlayer(socket.id);
      if (player && weaponType) {
        const weaponSystem = this.gameState.getWeaponSystem();
        const config = weaponSystem.getWeaponConfig(weaponType as any);
        if (config) {
          const weapon = weaponSystem.createWeapon(weaponType as any, config);
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
        const grenadeThrowEvent: GrenadeThrowEvent = {
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
      } else {
        console.error(`❌ Player ${socket.id} not found for team verification`);
      }
    });
    
    // Add debug match end support
    socket.on('debug:trigger_match_end', (data) => {
      console.log(`🧪 [DEBUG] Manual match end triggered by ${socket.id.substring(0, 8)}`, data);
      
      if (this.status !== 'playing') {
        console.log(`⚠️ Cannot trigger match end - lobby status is '${this.status}'`);
        socket.emit('debug:match_end_failed', { reason: `Lobby status is '${this.status}', must be 'playing'` });
        return;
      }
      
      // Get current kill counts
      const players = this.gameState.getPlayers();
      let redKills = 0;
      let blueKills = 0;
      
      for (const [playerId, playerState] of players) {
        if (playerState.team === 'red') {
          redKills += playerState.kills;
        } else if (playerState.team === 'blue') {
          blueKills += playerState.kills;
        }
      }
      
      // Force end the match with current scores
      console.log(`🧪 [DEBUG] Force ending match - Red: ${redKills}, Blue: ${blueKills}`);
      this.endMatch(redKills, blueKills);
      
      socket.emit('debug:match_end_triggered', {
        redKills,
        blueKills,
        reason: 'Debug command'
      });
    });
    
    // Also listen for variant name (frontend might try multiple)
    socket.on('debug:triggerMatchEnd', (data) => {
      console.log(`🧪 [DEBUG] Manual match end triggered (variant) by ${socket.id.substring(0, 8)}`, data);
      
      if (this.status !== 'playing') {
        console.log(`⚠️ Cannot trigger match end - lobby status is '${this.status}'`);
        socket.emit('debug:match_end_failed', { reason: `Lobby status is '${this.status}', must be 'playing'` });
        return;
      }
      
      // Force red team to win
      const players = this.gameState.getPlayers();
      let redKills = 50;
      let blueKills = 0;
      
      // Force end the match
      console.log(`🧪 [DEBUG] Force ending match - Red: ${redKills}, Blue: ${blueKills}`);
      this.endMatch(redKills, blueKills);
      
      socket.emit('debug:match_end_triggered', {
        success: true,
        winner: 'red',
        redKills,
        blueKills,
        reason: 'Debug command (variant)'
      });
    });
    
    // Add debug match state support
    socket.on('debug:request_match_state', (data) => {
      console.log(`🧪 [DEBUG] Match state requested by ${socket.id.substring(0, 8)}`);
      
      const players = this.gameState.getPlayers();
      let redKills = 0;
      let blueKills = 0;
      const playerStats = [];
      
      for (const [playerId, playerState] of players) {
        if (playerState.team === 'red') {
          redKills += playerState.kills;
        } else if (playerState.team === 'blue') {
          blueKills += playerState.kills;
        }
        
        playerStats.push({
          playerId: playerId,
          playerName: playerState.name || `Player ${playerId.substring(0, 8)}`,
          team: playerState.team,
          kills: playerState.kills,
          deaths: playerState.deaths,
          isAlive: playerState.isAlive
        });
      }
      
      socket.emit('debug:match_state', {
        lobbyId: this.id,
        status: this.status,
        playerCount: this.players.size,
        redKills: redKills,
        blueKills: blueKills,
        killTarget: this.killTarget,
        matchStartTime: this.matchStartTime,
        currentTime: Date.now(),
        players: playerStats
      });
      
      console.log(`🧪 [DEBUG] Sent match state - Status: ${this.status}, Red: ${redKills}, Blue: ${blueKills}`);
    });
    
    // Also listen for variant name for match state
    socket.on('debug:requestMatchState', (data) => {
      console.log(`🧪 [DEBUG] Match state requested (variant) by ${socket.id.substring(0, 8)}`);
      
      const players = this.gameState.getPlayers();
      let redKills = 0;
      let blueKills = 0;
      const playerStats = [];
      
      for (const [playerId, playerState] of players) {
        if (playerState.team === 'red') {
          redKills += playerState.kills;
        } else if (playerState.team === 'blue') {
          blueKills += playerState.kills;
        }
        
        playerStats.push({
          playerId: playerId,
          playerName: playerState.name || `Player ${playerId.substring(0, 8)}`,
          team: playerState.team,
          kills: playerState.kills,
          deaths: playerState.deaths,
          isAlive: playerState.isAlive
        });
      }
      
      socket.emit('debug:match_state', {
        lobbyId: this.id,
        status: this.status,
        playerCount: this.players.size,
        redKills: redKills,
        blueKills: blueKills,
        killTarget: this.killTarget,
        matchStartTime: this.matchStartTime,
        currentTime: Date.now(),
        players: playerStats
      });
      
      console.log(`🧪 [DEBUG] Sent match state (variant) - Status: ${this.status}, Red: ${redKills}, Blue: ${blueKills}`);
    });
    
    // Listen for any events for debugging
    socket.onAny((eventName: string, ...args: any[]) => {
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
      playerCount: this.players.size,  // Top-level field as frontend expects
      playerId: socket.id,
      timestamp: Date.now()
    });
  }
  
  removePlayer(playerId: string): void {
    this.players.delete(playerId);
    this.gameState.removePlayer(playerId);
    
    // CRITICAL FIX: Broadcast to lobby room only, not globally
    this.broadcastToLobby(EVENTS.PLAYER_LEFT, { 
      playerId
    });
    
    // Broadcast player left event with frontend's expected structure
    this.broadcastToLobby('player_left_lobby', {
      lobbyId: this.id,
      playerCount: this.players.size,  // Top-level field as frontend expects
      playerId: playerId,
      timestamp: Date.now()
    });
    
    // Notify callbacks about player count change
    this.notifyPlayerCountChange();
    this.updateActivity();
  }
  
  private startGameLoop(): void {
    this.gameLoopInterval = setInterval(() => {
      this.physics.update(1000 / GAME_CONFIG.TICK_RATE);
      this.gameState.update(1000 / GAME_CONFIG.TICK_RATE);
      
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
    }, 1000 / GAME_CONFIG.TICK_RATE);
    
    this.networkInterval = setInterval(() => {
      // Send filtered game state to each player based on their vision
      for (const [playerId, socket] of this.players) {
        const filteredState = this.gameState.getFilteredGameState(playerId);
        
        // Debug logging removed - was causing console spam
        
        if (!socket.connected) {
          console.warn(`⚠️ Socket ${playerId} is disconnected but still in players map!`);
          continue;
        }
        
        socket.emit(EVENTS.GAME_STATE, filteredState);
      }
    }, 1000 / GAME_CONFIG.NETWORK_RATE);
  }
  
  isInitialized(): boolean {
    return this.initialized;
  }
  
  destroy(): void {
    if (this.gameLoopInterval) clearInterval(this.gameLoopInterval);
    if (this.networkInterval) clearInterval(this.networkInterval);
    this.physics.destroy();
  }

  // Simple game reset without system recreation
  async resetGame(): Promise<void> {
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
        socket.emit(EVENTS.GAME_STATE, filteredState);
        
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
          weapons: {},  // Will be populated when player sends weapon:equip
          isAlive: playerState.isAlive,
          movementState: playerState.movementState,
          isADS: playerState.isADS,
          lastDamageTime: playerState.lastDamageTime,
          kills: playerState.kills,
          deaths: playerState.deaths,
          transform: playerState.transform
        };
        
        // CRITICAL FIX: Only broadcast to players in THIS lobby, not all players
        this.broadcastToLobby(EVENTS.PLAYER_JOINED, flattenedPlayerState);
      }
    });
    
    console.log(`✅ Game reset complete! ${connectedPlayers.length} players restored`);
  }
  
  // ===== MULTI-LOBBY SUPPORT METHODS =====
  
  getId(): string {
    return this.id;
  }
  
  getPlayerCount(): number {
    return this.players.size;
  }
  
  getMaxPlayers(): number {
    return this.maxPlayers;
  }
  
  setMaxPlayers(max: number): void {
    this.maxPlayers = Math.min(max, parseInt(process.env.MAX_PLAYERS_PER_LOBBY || '8'));
  }
  
  getGameMode(): string {
    return this.gameMode;
  }
  
  setGameMode(mode: string): void {
    this.gameMode = mode;
  }
  
  getMapName(): string {
    return this.mapName;
  }
  
  setMapName(name: string): void {
    this.mapName = name;
  }
  
  isPrivate(): boolean {
    return this.isPrivateRoom;
  }
  
  setPrivate(isPrivate: boolean): void {
    this.isPrivateRoom = isPrivate;
  }
  
  hasPassword(): boolean {
    return !!this.password;
  }
  
  setPassword(password: string): void {
    this.password = password;
    this.isPrivateRoom = true;
  }
  
  verifyPassword(password: string): boolean {
    return this.password === password;
  }
  
  getStatus(): 'waiting' | 'playing' | 'finished' {
    return this.status;
  }
  
  setStatus(status: 'waiting' | 'playing' | 'finished'): void {
    this.status = status;
    this.lastActivity = Date.now();
  }
  
  getCreatedAt(): number {
    return this.createdAt;
  }
  
  getLastActivity(): number {
    return this.lastActivity;
  }
  
  updateActivity(): void {
    this.lastActivity = Date.now();
  }
  
  // ===== MATCH MANAGEMENT METHODS =====
  
  startMatch(): void {
    this.status = 'playing';
    this.matchStartTime = Date.now();
    this.updateActivity();
    
    console.log(`🎮 Match started in lobby ${this.id}`);
    
    // NOTE: match_started event is broadcast by LobbyManager.startMatch()
    // to avoid duplicate events
  }
  
  resetForNewMatch(): void {
    this.status = 'waiting';
    this.matchStartTime = undefined;
    this.updateActivity();
    
    // Reset game state
    this.gameState.resetAllState();
    
    console.log(`🔄 Lobby ${this.id} reset for new match`);
  }
  
  checkVictoryCondition(): boolean {
    if (this.status !== 'playing') return false;
    
    const players = this.gameState.getPlayers();
    let redKills = 0;
    let blueKills = 0;
    
    // Calculate team kill counts
    for (const [playerId, playerState] of players) {
      if (playerState.team === 'red') {
        redKills += playerState.kills;
      } else if (playerState.team === 'blue') {
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
  
  private endMatch(redKills: number, blueKills: number): void {
    const winnerTeam = redKills >= this.killTarget ? 'red' : 'blue';
    const matchDuration = this.matchStartTime ? Date.now() - this.matchStartTime : 0;
    
    this.status = 'finished';
    this.updateActivity();
    
    // Gather player statistics
    const playerStats: Array<{
      playerId: string;
      playerName: string;
      team: 'red' | 'blue';
      kills: number;
      deaths: number;
      damageDealt: number;
    }> = [];
    
    for (const [playerId, playerState] of this.gameState.getPlayers()) {
      playerStats.push({
        playerId: playerId,
        playerName: playerState.name || `Player ${playerId.substring(0, 8)}`, // Use actual player name
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
      killTarget: this.killTarget,
      playerStats
    };
    
    console.log(`🏁 Match ended in lobby ${this.id} - Winner: ${winnerTeam} (${redKills} vs ${blueKills} kills)`);
    
    // Broadcast match end to all players in lobby
    this.broadcastToLobby('match_ended', matchData);
    
    // Trigger match end callbacks
    this.matchEndCallbacks.forEach(callback => {
      try {
        callback(matchData);
      } catch (error) {
        console.error('Error in match end callback:', error);
      }
    });
  }
  
  // ===== EVENT BROADCASTING METHODS =====
  
  broadcastToLobby(event: string, data: any): void {
    this.io.to(this.id).emit(event, data);
  }
  
  // Get comprehensive lobby state for broadcasting
  getLobbyState(): any {
    const players = Array.from(this.players.keys()).map(id => {
      const player = this.gameState.getPlayer(id);
      if (!player) return null;
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
  broadcastLobbyState(): void {
    this.broadcastToLobby('lobby_state_update', this.getLobbyState());
  }
  
  // ===== CALLBACK REGISTRATION METHODS =====
  
  onMatchEnd(callback: (matchData: any) => void): void {
    this.matchEndCallbacks.push(callback);
  }
  
  onPlayerCountChange(callback: (count: number) => void): void {
    this.playerCountChangeCallbacks.push(callback);
  }
  
  private notifyPlayerCountChange(): void {
    const count = this.players.size;
    this.playerCountChangeCallbacks.forEach(callback => {
      try {
        callback(count);
      } catch (error) {
        console.error('Error in player count change callback:', error);
      }
    });
  }
}