import { GameState, PlayerState, InputState } from '../../shared/types';
import { GAME_CONFIG } from '../../shared/constants';
import { PhysicsSystem } from './PhysicsSystem';
import Matter from 'matter-js';

export class GameStateSystem {
  private players: Map<string, PlayerState> = new Map();
  private playerBodies: Map<string, Matter.Body> = new Map();
  private lastUpdateTime: number = Date.now();
  private physics: PhysicsSystem;
  private lastInputSequence: Map<string, number> = new Map();
  
  constructor(physics: PhysicsSystem) {
    this.physics = physics;
    console.log('GameStateSystem initialized');
  }
  
  createPlayer(id: string): PlayerState {
    const player: PlayerState = {
      id,
      transform: {
        position: { x: 240, y: 135 },
        rotation: 0,
        scale: { x: 1, y: 1 }
      },
      velocity: { x: 0, y: 0 },
      health: GAME_CONFIG.PLAYER_HEALTH,
      armor: 0,
      team: Math.random() > 0.5 ? 'red' : 'blue',
      weaponId: 'rifle',
      isAlive: true,
      movementState: 'idle'
    };
    
    // Create physics body for the player
    const body = Matter.Bodies.circle(
      player.transform.position.x,
      player.transform.position.y,
      GAME_CONFIG.PLAYER_SIZE / 2,
      {
        friction: 0.1,
        frictionAir: 0.05,
        restitution: 0.1,
        label: `player:${id}`,
        render: { visible: false }
      }
    );
    
    this.physics.addBody(body);
    this.playerBodies.set(id, body);
    this.players.set(id, player);
    this.lastInputSequence.set(id, 0);
    
    return player;
  }
  
  removePlayer(id: string): void {
    const body = this.playerBodies.get(id);
    if (body) {
      this.physics.removeBody(body);
      this.playerBodies.delete(id);
    }
    this.players.delete(id);
    this.lastInputSequence.delete(id);
  }
  
  handlePlayerInput(playerId: string, input: InputState): void {
    const player = this.players.get(playerId);
    const body = this.playerBodies.get(playerId);
    
    if (!player || !body || !player.isAlive) return;
    
    // Input validation - prevent cheating
    if (!this.validateInput(playerId, input)) {
      console.warn(`Invalid input from player ${playerId}`);
      return;
    }
    
    // Update input sequence tracking
    this.lastInputSequence.set(playerId, input.sequence);
    
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
      const baseSpeed = GAME_CONFIG.PLAYER_SPEED_WALK;
      const finalSpeed = baseSpeed * speedModifier;
      
      const targetVelocity = {
        x: normalizedVector.x * finalSpeed,
        y: normalizedVector.y * finalSpeed
      };
      
      // Apply position directly (physics bypassed temporarily)
      const deltaTime = 1000 / GAME_CONFIG.TICK_RATE; // 16.67ms
      const deltaSeconds = deltaTime / 1000; // Convert to seconds
      
      player.transform.position.x += targetVelocity.x * deltaSeconds;
      player.transform.position.y += targetVelocity.y * deltaSeconds;
      
      // Update player velocity in state
      player.velocity = targetVelocity;
    } else {
      // No movement input - apply friction directly to player state
      player.velocity = {
        x: player.velocity.x * 0.8,
        y: player.velocity.y * 0.8
      };
    }
    
    // TEMPORARILY BYPASS PHYSICS - Position already updated above
    // console.log(`   Physics body position after input: (${body.position.x.toFixed(2)}, ${body.position.y.toFixed(2)})`);
    // player.transform.position = {
    //   x: body.position.x,
    //   y: body.position.y
    // };
    
    // Handle rotation based on mouse position
    this.updatePlayerRotation(player, input);
    
    // Update movement state
    player.movementState = movementState;
  }
  
  private validateInput(playerId: string, input: InputState): boolean {
    // Check timestamp (prevent old/future inputs)
    const now = Date.now();
    const timeDiff = Math.abs(now - input.timestamp);
    
    if (timeDiff > 1000) { // 1 second tolerance
      return false;
    }
    
    // Check sequence number (prevent replay attacks)
    const lastSequence = this.lastInputSequence.get(playerId) || 0;
    if (input.sequence <= lastSequence) {
      return false;
    }
    
    // Validate input ranges
    if (input.mouse.x < 0 || input.mouse.x > GAME_CONFIG.GAME_WIDTH * GAME_CONFIG.SCALE_FACTOR ||
        input.mouse.y < 0 || input.mouse.y > GAME_CONFIG.GAME_HEIGHT * GAME_CONFIG.SCALE_FACTOR) {
      return false;
    }
    
    if (input.mouse.buttons < 0 || input.mouse.buttons > 7) { // 3 bits for mouse buttons
      return false;
    }
    
    return true;
  }
  
  private calculateMovementVector(input: InputState): { x: number; y: number } {
    let x = 0;
    let y = 0;
    
    if (input.keys.a) x -= 1;
    if (input.keys.d) x += 1;
    if (input.keys.w) y -= 1;
    if (input.keys.s) y += 1;
    
    return { x, y };
  }
  
  private getMovementState(input: InputState, movementVector: { x: number; y: number }): 'idle' | 'walking' | 'running' | 'sneaking' {
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
  
  private getSpeedModifier(movementState: 'idle' | 'walking' | 'running' | 'sneaking'): number {
    switch (movementState) {
      case 'sneaking':
        return GAME_CONFIG.PLAYER_SPEED_SNEAK / GAME_CONFIG.PLAYER_SPEED_WALK;
      case 'walking':
        return 1.0;
      case 'running':
        return GAME_CONFIG.PLAYER_SPEED_RUN / GAME_CONFIG.PLAYER_SPEED_WALK;
      default:
        return 0;
    }
  }
  
  private updatePlayerRotation(player: PlayerState, input: InputState): void {
    // Calculate rotation based on mouse position relative to player
    const playerScreenX = player.transform.position.x * GAME_CONFIG.SCALE_FACTOR;
    const playerScreenY = player.transform.position.y * GAME_CONFIG.SCALE_FACTOR;
    
    const deltaX = input.mouse.x - playerScreenX;
    const deltaY = input.mouse.y - playerScreenY;
    
    // Calculate angle in radians
    const angle = Math.atan2(deltaY, deltaX);
    
    player.transform.rotation = angle;
  }
  
  handlePlayerShoot(playerId: string, data: any): void {
    const player = this.players.get(playerId);
    if (!player || !player.isAlive) return;
    
    // TODO: Implement shooting logic
    console.log(`Player ${playerId} shooting with weapon ${player.weaponId}`);
    
    // Create projectile based on player position and rotation
    // This would integrate with a ProjectileSystem
  }
  
  update(delta: number): void {
    const now = Date.now();
    const deltaTime = now - this.lastUpdateTime;
    this.lastUpdateTime = now;
    
    // TEMPORARILY BYPASS PHYSICS - Apply boundary clamping directly to player state
    for (const [playerId, player] of this.players) {
      // Apply boundary clamping to player state
      const clampedX = Math.max(GAME_CONFIG.PLAYER_SIZE / 2, 
        Math.min(GAME_CONFIG.GAME_WIDTH - GAME_CONFIG.PLAYER_SIZE / 2, player.transform.position.x));
      const clampedY = Math.max(GAME_CONFIG.PLAYER_SIZE / 2, 
        Math.min(GAME_CONFIG.GAME_HEIGHT - GAME_CONFIG.PLAYER_SIZE / 2, player.transform.position.y));
      
      if (player.transform.position.x !== clampedX || player.transform.position.y !== clampedY) {
        player.transform.position.x = clampedX;
        player.transform.position.y = clampedY;
      }
      
      // Update movement state based on velocity
      const speed = Math.sqrt(player.velocity.x * player.velocity.x + player.velocity.y * player.velocity.y);
      if (speed < 10) {
        player.movementState = 'idle';
      }
      
      // console.log(`🔍 FINAL PLAYER POSITION for ${playerId}: (${player.transform.position.x.toFixed(2)}, ${player.transform.position.y.toFixed(2)}) | velocity=(${player.velocity.x.toFixed(2)}, ${player.velocity.y.toFixed(2)})`);
    }
  }
  
  getState(): GameState {
    // Convert Map to plain object for JSON serialization
    const playersObject: { [key: string]: PlayerState } = {};
    for (const [id, player] of this.players) {
      playersObject[id] = player;
    }
    
    return {
      players: playersObject as any, // Cast to maintain interface compatibility
      walls: new Map(),
      projectiles: [],
      timestamp: Date.now(),
      tickRate: GAME_CONFIG.TICK_RATE
    };
  }
  
  getPlayerBody(playerId: string): Matter.Body | undefined {
    return this.playerBodies.get(playerId);
  }
}
