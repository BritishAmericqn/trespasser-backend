import { Socket, Server } from 'socket.io';
import { GameState, PlayerState } from '../../shared/types';
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
    const playerState = this.gameState.createPlayer(socket.id);
    socket.emit(EVENTS.GAME_STATE, this.gameState.getState());
    socket.broadcast.emit(EVENTS.PLAYER_JOINED, playerState);
    
    socket.on(EVENTS.PLAYER_INPUT, (input) => {
      this.gameState.handlePlayerInput(socket.id, input);
    });
    
    socket.on(EVENTS.PLAYER_SHOOT, (data) => {
      this.gameState.handlePlayerShoot(socket.id, data);
    });
    
    socket.on('disconnect', () => {
      console.log(`👋 Player ${socket.id} left the game`);
      this.removePlayer(socket.id);
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
