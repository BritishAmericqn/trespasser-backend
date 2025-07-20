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
    }
  }
  
  addPlayer(socket: Socket): void {
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
    
    socket.broadcast.emit(EVENTS.PLAYER_JOINED, flattenedPlayerState);
    
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
        // Broadcast all events to all players
        for (const eventData of result.events) {
          console.log(`   Event: ${eventData.type} from player ${weaponFireEvent.playerId.substring(0, 8)}`);
          if (eventData.type === 'weapon:hit') {
            console.log(`   🎯 HIT EVENT DATA:`, JSON.stringify(eventData.data, null, 2));
          }
          
          this.io.emit(eventData.type, eventData.data);
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
          this.io.emit(eventData.type, eventData.data);
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
          this.io.emit(eventData.type, eventData.data);
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
          this.io.emit(eventData.type, eventData.data);
        }
      }
    });
    
    // Player join handler - NEW! Receives loadout from frontend after auth
    socket.on('player:join', (data: { loadout: { primary: string; secondary: string; support: string[]; team: string }, timestamp: number }) => {
      console.log(`🎮 Player ${socket.id} joining with loadout:`, data.loadout);
      
      const player = this.gameState.getPlayer(socket.id);
      if (!player) {
        console.error(`❌ Player ${socket.id} not found`);
        return;
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
      socket.emit('weapon:equipped', {
        weapons: Array.from(player.weapons.keys()),
        currentWeapon: player.weaponId
      });
    });
    
    // Weapon equip handler - for when players select weapons before match
    socket.on('weapon:equip', (weaponData: { primary?: string, secondary?: string, support?: string[] }) => {
      const player = this.gameState.getPlayer(socket.id);
      if (!player) return;
      
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
    
    // Manual respawn handler
    socket.on('player:respawn', () => {
      const player = this.gameState.getPlayer(socket.id);
      if (player && !player.isAlive && player.deathTime) {
        const now = Date.now();
        const timeSinceDeath = now - player.deathTime;
        
        // Allow respawn after minimum death time
        if (timeSinceDeath >= GAME_CONFIG.DEATH.DEATH_CAM_DURATION) {
          console.log(`🔄 Manual respawn requested by ${socket.id.substring(0, 8)}`);
          this.gameState.respawnPlayer(socket.id);
        } else {
          const remainingTime = GAME_CONFIG.DEATH.DEATH_CAM_DURATION - timeSinceDeath;
          console.log(`⏰ Respawn denied for ${socket.id.substring(0, 8)} - ${remainingTime}ms remaining`);
        }
      }
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
            this.io.emit(eventData.type, eventData.data);
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
    
    // Listen for any events for debugging
    socket.onAny((eventName: string, ...args: any[]) => {
      if (!eventName.includes('player:input') && 
          !eventName.includes('ping') && 
          !eventName.includes('pong')) {
        // Removed debug logging
      }
    });
  }
  
  removePlayer(playerId: string): void {
    this.players.delete(playerId);
    this.gameState.removePlayer(playerId);
    this.io.emit(EVENTS.PLAYER_LEFT, { playerId });
  }
  
  private startGameLoop(): void {
    this.gameLoopInterval = setInterval(() => {
      this.physics.update(1000 / GAME_CONFIG.TICK_RATE);
      this.gameState.update(1000 / GAME_CONFIG.TICK_RATE);
      
      // CRITICAL FIX: Broadcast pending wall damage events from projectiles/explosions
      const pendingEvents = this.gameState.getPendingEvents();
      if (pendingEvents.length > 0) {
        // console.log(`📤 Broadcasting ${pendingEvents.length} pending events`);
      }
      for (const event of pendingEvents) {
        // console.log(`📤 Emitting ${event.type}:`, event.data);
        this.io.emit(event.type, event.data);
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
  resetGame(): void {
    console.log('🔄 Resetting game state...');
    
    // Store connected players before reset
    const connectedPlayers = Array.from(this.players.keys());
    
    // Clear all game state (but keep systems intact)
    this.gameState.resetAllState();
    
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
        
        socket.broadcast.emit(EVENTS.PLAYER_JOINED, flattenedPlayerState);
      }
    });
    
    console.log(`✅ Game reset complete! ${connectedPlayers.length} players restored`);
  }
}