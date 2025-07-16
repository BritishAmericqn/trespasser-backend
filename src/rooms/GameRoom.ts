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
    socket.emit(EVENTS.GAME_STATE, filteredState);
    socket.broadcast.emit(EVENTS.PLAYER_JOINED, playerState);
    
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
        chargeLevel: event.chargeLevel              // Pass through charge level for grenades
      };
      
      const result = this.gameState.handleWeaponFire(weaponFireEvent);
      if (result.success) {
        // Broadcast all events to all players
        for (const eventData of result.events) {
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
    
    // Legacy events (keeping for compatibility)
    socket.on(EVENTS.PLAYER_SHOOT, (data) => {
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
        socket.emit(EVENTS.GAME_STATE, filteredState);
      }
    }, 1000 / GAME_CONFIG.NETWORK_RATE);
  }
  
  destroy(): void {
    if (this.gameLoopInterval) clearInterval(this.gameLoopInterval);
    if (this.networkInterval) clearInterval(this.networkInterval);
    this.physics.destroy();
  }
}
