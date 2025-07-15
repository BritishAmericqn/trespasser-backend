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
  
  constructor(id: string, io: Server) {
    this.id = id;
    this.io = io;
    this.physics = new PhysicsSystem();
    this.gameState = new GameStateSystem(this.physics);
    this.startGameLoop();
  }
  
  addPlayer(socket: Socket): void {
    console.log(`🎮 Player ${socket.id} joined the game`);
    this.players.set(socket.id, socket);
    
    // CRITICAL: Join the socket to this room so they receive broadcasts
    socket.join(this.id);
    
    const playerState = this.gameState.createPlayer(socket.id);
    socket.emit(EVENTS.GAME_STATE, this.gameState.getState());
    socket.broadcast.emit(EVENTS.PLAYER_JOINED, playerState);
    
    // Player input handling
    socket.on(EVENTS.PLAYER_INPUT, (input) => {
      this.gameState.handlePlayerInput(socket.id, input);
    });
    
    // Weapon events
    socket.on(EVENTS.WEAPON_FIRE, (event: any) => {
      console.log(`🔍 Received event: weapon:fire`, event);
      // Get the server's authoritative player position
      const player = this.gameState.getPlayer(socket.id);
      if (!player) {
        console.warn(`❌ No player found for socket ${socket.id}`);
        return;
      }
      
      // Debug: Log position mismatch
      if (event.position) {
        const clientPos = event.position;
        const serverPos = player.transform.position;
        const offsetX = serverPos.x - clientPos.x;
        const offsetY = serverPos.y - clientPos.y;
        console.log(`🎯 POSITION CHECK for ${socket.id.substring(0, 8)}:`);
        console.log(`   Client sent: (${clientPos.x.toFixed(2)}, ${clientPos.y.toFixed(2)})`);
        console.log(`   Server has:  (${serverPos.x.toFixed(2)}, ${serverPos.y.toFixed(2)})`);
        console.log(`   Offset:      (${offsetX.toFixed(2)}, ${offsetY.toFixed(2)})`);
      }
      
      // Debug: Log angle mismatch
      if (event.direction !== undefined) {
        const clientAngle = event.direction * 180 / Math.PI;
        const serverAngle = player.transform.rotation * 180 / Math.PI;
        const angleDiff = Math.abs(clientAngle - serverAngle);
        console.log(`🎯 ANGLE CHECK:`);
        console.log(`   Client sent: ${clientAngle.toFixed(1)}°`);
        console.log(`   Server has:  ${serverAngle.toFixed(1)}°`);
        console.log(`   Difference:  ${angleDiff.toFixed(1)}°`);
      }
      
      // Use server position, not client position
      const weaponFireEvent: WeaponFireEvent = {
        playerId: socket.id,
        weaponType: event.weaponType,
        position: { ...player.transform.position }, // Use server position
        direction: player.transform.rotation,        // Use server rotation, not client!
        isADS: event.isADS,
        timestamp: event.timestamp,
        sequence: event.sequence
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
      console.log(`👋 Player ${socket.id} left the game`);
      this.removePlayer(socket.id);
    });
    
    // Debug events (for testing)
    socket.on('debug:repair_walls', () => {
      this.gameState.getDestructionSystem().resetAllWalls();
      console.log('🔧 All walls repaired');
    });
    
    socket.on('debug:destruction_stats', () => {
      const stats = this.gameState.getDestructionSystem().getDestructionStats();
      console.log('📊 Destruction stats:', stats);
      socket.emit('debug:destruction_stats', stats);
    });
    
    // Listen for any events for debugging
    socket.onAny((eventName, data) => {
      if (!eventName.startsWith('debug:') && eventName !== EVENTS.PLAYER_INPUT) {
        console.log(`🔍 Received event: ${eventName}`, data);
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
        console.log(`📤 Broadcasting ${pendingEvents.length} pending events`);
      }
      for (const event of pendingEvents) {
        console.log(`📤 Emitting ${event.type}:`, event.data);
        this.io.emit(event.type, event.data);
      }
    }, 1000 / GAME_CONFIG.TICK_RATE);
    
    this.networkInterval = setInterval(() => {
      const state = this.gameState.getState();
      this.io.to(this.id).emit(EVENTS.GAME_STATE, state);
    }, 1000 / GAME_CONFIG.NETWORK_RATE);
  }
  
  destroy(): void {
    if (this.gameLoopInterval) clearInterval(this.gameLoopInterval);
    if (this.networkInterval) clearInterval(this.networkInterval);
    this.physics.destroy();
  }
}
