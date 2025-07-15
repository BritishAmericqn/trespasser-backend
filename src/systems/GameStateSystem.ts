import { GameState, PlayerState, InputState, WeaponState, WeaponFireEvent, WeaponReloadEvent, WeaponSwitchEvent, GrenadeThrowEvent, PlayerDamageEvent, WallDamageEvent, Vector2 } from '../../shared/types';
import { GAME_CONFIG, EVENTS } from '../../shared/constants';
import { PhysicsSystem } from './PhysicsSystem';
import { WeaponSystem } from './WeaponSystem';
import { ProjectileSystem } from './ProjectileSystem';
import { DestructionSystem } from './DestructionSystem';
import Matter from 'matter-js';

export class GameStateSystem {
  private players: Map<string, PlayerState> = new Map();
  private playerBodies: Map<string, Matter.Body> = new Map();
  private lastUpdateTime: number = Date.now();
  private physics: PhysicsSystem;
  private weaponSystem: WeaponSystem;
  private projectileSystem: ProjectileSystem;
  private destructionSystem: DestructionSystem;
  private lastInputSequence: Map<string, number> = new Map();
  private pendingWallDamageEvents: any[] = [];
  private pendingReloadCompleteEvents: any[] = [];
  private pendingProjectileEvents: any[] = [];
  
  constructor(physics: PhysicsSystem) {
    this.physics = physics;
    this.weaponSystem = new WeaponSystem();
    this.projectileSystem = new ProjectileSystem(physics, this.weaponSystem);
    this.destructionSystem = new DestructionSystem(physics);
    
    // Set up reload complete callback
    this.weaponSystem.setReloadCompleteCallback((playerId: string, weapon: WeaponState) => {
      this.pendingReloadCompleteEvents.push({
        type: EVENTS.WEAPON_RELOADED,
        data: {
          playerId,
          weaponType: weapon.type,
          currentAmmo: weapon.currentAmmo,
          reserveAmmo: weapon.reserveAmmo
        }
      });
    });
    
    console.log('GameStateSystem initialized with weapon systems');
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
      weapons: this.weaponSystem.initializePlayerWeapons(id),
      isAlive: true,
      movementState: 'idle',
      isADS: false,
      lastDamageTime: 0,
      kills: 0,
      deaths: 0
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
    
    console.log(`🔧 CREATING PLAYER BODY at position: (${player.transform.position.x}, ${player.transform.position.y})`);
    console.log(`🎮 PLAYER SPAWNED: ${id} at (${player.transform.position.x}, ${player.transform.position.y})`);
    this.physics.addBody(body);
    this.playerBodies.set(id, body);
    
    console.log(`🔧 PHYSICS BODY CREATED at: (${body.position.x}, ${body.position.y})`);
    console.log(`🔧 PHYSICS BODY AFTER ADDING TO WORLD: (${body.position.x}, ${body.position.y})`);
    
    this.players.set(id, player);
    this.lastInputSequence.set(id, 0);
    
    // Debug: Set up periodic position logging for this player
    setInterval(() => {
      const currentPlayer = this.players.get(id);
      if (currentPlayer && currentPlayer.isAlive) {
        console.log(`📍 POSITION CHECK ${id.substring(0, 8)}: (${currentPlayer.transform.position.x.toFixed(2)}, ${currentPlayer.transform.position.y.toFixed(2)}) | vel: (${currentPlayer.velocity.x.toFixed(2)}, ${currentPlayer.velocity.y.toFixed(2)}) | state: ${currentPlayer.movementState}`);
      }
    }, 1000);
    
    return player;
  }
  
  getPlayer(id: string): PlayerState | undefined {
    return this.players.get(id);
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
    
    // Debug: Log input details
    const beforePos = { ...player.transform.position };
    
    // Input validation - prevent cheating
    if (!this.validateInput(playerId, input)) {
      console.warn(`Invalid input from player ${playerId}`);
      return;
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
    
    // Debug: Log position change
    if (beforePos.x !== player.transform.position.x || beforePos.y !== player.transform.position.y) {
      console.log(`🎮 INPUT ${playerId.substring(0, 8)} seq:${input.sequence} | before: (${beforePos.x.toFixed(2)}, ${beforePos.y.toFixed(2)}) → after: (${player.transform.position.x.toFixed(2)}, ${player.transform.position.y.toFixed(2)}) | keys: ${Object.entries(input.keys).filter(([k, v]) => v).map(([k]) => k).join(',')}`);
    }
  }
  
  private handleWeaponInputs(playerId: string, input: InputState): void {
    const player = this.players.get(playerId);
    if (!player) return;
    
    // Handle weapon firing
    if (input.mouse.leftPressed) {
      const weaponFireEvent: WeaponFireEvent = {
        playerId,
        weaponType: player.weaponId as 'rifle' | 'pistol' | 'grenade' | 'rocket',
        position: { ...player.transform.position },
        direction: player.transform.rotation,
        isADS: player.isADS,
        timestamp: Date.now(),
        sequence: input.sequence
      };
      
      this.handleWeaponFire(weaponFireEvent);
    }
    
    // Handle weapon switching
    if (input.keys['1'] && player.weaponId !== 'rifle') {
      this.handleWeaponSwitch(playerId, 'rifle');
    }
    if (input.keys['2'] && player.weaponId !== 'pistol') {
      this.handleWeaponSwitch(playerId, 'pistol');
    }
    if (input.keys['3'] && player.weaponId !== 'grenade') {
      this.handleWeaponSwitch(playerId, 'grenade');
    }
    if (input.keys['4'] && player.weaponId !== 'rocket') {
      this.handleWeaponSwitch(playerId, 'rocket');
    }
    
    // Handle reload
    if (input.keys.r) {
      this.handleWeaponReload(playerId);
    }
    
    // Handle grenade throwing
    if (input.keys.g && player.weaponId === 'grenade') {
      // For now, treat G key as instant throw with charge level 3
      const grenadeThrowEvent: GrenadeThrowEvent = {
        playerId,
        position: { ...player.transform.position },
        direction: player.transform.rotation,
        chargeLevel: 3,
        timestamp: Date.now()
      };
      
      this.handleGrenadeThrow(grenadeThrowEvent);
    }
  }
  
  private handleMovementInputs(playerId: string, input: InputState): void {
    const player = this.players.get(playerId);
    if (!player) return;
    
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
      
      const positionDelta = {
        x: targetVelocity.x * deltaSeconds,
        y: targetVelocity.y * deltaSeconds
      };
      
      // Debug: Log movement calculation
      if (Math.random() < 0.05) { // Log 5% of movements to avoid spam
        console.log(`🏃 MOVEMENT CALC ${playerId.substring(0, 8)}:`);
        console.log(`   Input: ${Object.entries(input.keys).filter(([k, v]) => v && ['w','a','s','d','shift','ctrl'].includes(k)).map(([k]) => k).join(',')}`);
        console.log(`   Movement vector: (${movementVector.x}, ${movementVector.y})`);
        console.log(`   Speed: base=${baseSpeed}, modifier=${speedModifier}, final=${finalSpeed}`);
        console.log(`   Delta: time=${deltaTime}ms, seconds=${deltaSeconds}`);
        console.log(`   Position delta: (${positionDelta.x.toFixed(4)}, ${positionDelta.y.toFixed(4)})`);
      }
      
      player.transform.position.x += positionDelta.x;
      player.transform.position.y += positionDelta.y;
      
      // Update player velocity in state
      player.velocity = targetVelocity;
    } else {
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
  handleWeaponFire(event: WeaponFireEvent): { success: boolean; events: any[] } {
    const player = this.players.get(event.playerId);
    if (!player) {
      return { success: false, events: [] };
    }
    
    const fireResult = this.weaponSystem.handleWeaponFire(event, player);
    if (!fireResult.canFire) {
      console.log(`🔫 Fire failed for ${event.playerId}: ${fireResult.error}`);
      return { success: false, events: [] };
    }
    
    const weapon = fireResult.weapon!;
    const weaponConfig = this.weaponSystem.getWeaponConfig(weapon.type);
    const events: any[] = [];
    
    // Handle hitscan weapons (rifle, pistol)
    if (weaponConfig.HITSCAN) {
      const hitscanResult = this.weaponSystem.performHitscan(
        event.position,
        event.direction,
        weapon.range,
        weapon,
        player,
        this.destructionSystem.getWalls(),
        this.players
      );
      
      // Debug logging
      console.log(`🎯 HITSCAN from (${event.position.x.toFixed(1)}, ${event.position.y.toFixed(1)}) dir: ${(event.direction * 180 / Math.PI).toFixed(1)}° - Result: ${hitscanResult.hit ? `HIT ${hitscanResult.targetType} at (${hitscanResult.hitPoint.x.toFixed(1)}, ${hitscanResult.hitPoint.y.toFixed(1)})` : 'MISS'}`);
      
      if (hitscanResult.hit) {
        if (hitscanResult.targetType === 'player' && hitscanResult.targetId) {
          // Player hit
          const targetPlayer = this.players.get(hitscanResult.targetId);
          if (targetPlayer) {
            const damage = this.weaponSystem.calculateDamage(weapon, hitscanResult.distance);
            const damageEvent = this.applyPlayerDamage(targetPlayer, damage, 'bullet', event.playerId, hitscanResult.hitPoint);
            events.push({ type: EVENTS.PLAYER_DAMAGED, data: damageEvent });
            
            if (damageEvent.isKilled) {
              player.kills++;
              events.push({ type: EVENTS.PLAYER_KILLED, data: damageEvent });
            }
          }
        } else if (hitscanResult.targetType === 'wall' && hitscanResult.targetId && hitscanResult.wallSliceIndex !== undefined) {
          // Wall hit
          console.log(`🧱 WALL HIT: ${hitscanResult.targetId} slice ${hitscanResult.wallSliceIndex}`);
          const wall = this.destructionSystem.getWall(hitscanResult.targetId);
          if (wall) {
            const damage = this.weaponSystem.calculateDamage(weapon, hitscanResult.distance);
            const damageEvent = this.destructionSystem.applyDamage(hitscanResult.targetId, hitscanResult.wallSliceIndex, damage);
            
            if (damageEvent) {
              events.push({ type: EVENTS.WALL_DAMAGED, data: damageEvent });
              console.log(`💥 WALL DAMAGED: ${damageEvent.wallId} slice ${damageEvent.sliceIndex} - new health: ${damageEvent.newHealth}`);
              
              if (damageEvent.isDestroyed) {
                events.push({ type: EVENTS.WALL_DESTROYED, data: damageEvent });
              }
            }
          }
        }
        
        events.push({ type: EVENTS.WEAPON_HIT, data: { 
          playerId: event.playerId, 
          position: hitscanResult.hitPoint,
          targetType: hitscanResult.targetType,
          targetId: hitscanResult.targetId
        }});
      } else {
        events.push({ type: EVENTS.WEAPON_MISS, data: { 
          playerId: event.playerId, 
          position: event.position,
          direction: event.direction
        }});
      }
    } else {
      // Handle projectile weapons (grenade, rocket)
      let velocity: Vector2;
      let projectileOptions: any = {
        range: weapon.range,
        explosionRadius: weaponConfig.EXPLOSION_RADIUS
      };
      
      if (weapon.type === 'grenade') {
        console.log(`🎯 Grenade fire event - chargeLevel: ${event.chargeLevel}`);
        if (event.chargeLevel) {
          // Use new grenade velocity system with charge levels
          const baseSpeed = GAME_CONFIG.WEAPONS.GRENADE.BASE_THROW_SPEED;
          const chargeBonus = GAME_CONFIG.WEAPONS.GRENADE.CHARGE_SPEED_BONUS;
          const speed = baseSpeed + (event.chargeLevel * chargeBonus); // 8-32 px/s range
          velocity = this.calculateProjectileVelocity(event.direction, speed);
          
          // Apply charge multiplier to range
          const chargeMultiplier = 1 + ((event.chargeLevel - 1) * 0.5);
          projectileOptions.range = weapon.range * chargeMultiplier;
          projectileOptions.chargeLevel = event.chargeLevel;
          
          console.log(`💣 Grenade throw: charge=${event.chargeLevel}, speed=${speed}, range=${projectileOptions.range}`);
        } else {
          // Fallback to default speed if no charge level
          console.log('⚠️  No charge level provided, using default speed');
          velocity = this.calculateProjectileVelocity(event.direction, weaponConfig.PROJECTILE_SPEED);
        }
      } else {
        // Regular projectile (rocket)
        velocity = this.calculateProjectileVelocity(event.direction, weaponConfig.PROJECTILE_SPEED);
      }
      
      const projectile = this.projectileSystem.createProjectile(
        weapon.type as 'bullet' | 'rocket' | 'grenade',
        event.position,
        velocity,
        event.playerId,
        weapon.damage,
        projectileOptions
      );
      
      events.push({ 
        type: EVENTS.PROJECTILE_CREATED, 
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
    
    // Add weapon fired event
    events.push({ 
      type: EVENTS.WEAPON_FIRED, 
      data: { 
        playerId: event.playerId, 
        weaponType: weapon.type,
        position: event.position,
        direction: event.direction,
        ammoRemaining: weapon.currentAmmo
      }
    });
    
    return { success: true, events };
  }
  
  // Handle weapon reload
  handleWeaponReload(playerId: string): { success: boolean; events: any[] } {
    const player = this.players.get(playerId);
    if (!player) {
      return { success: false, events: [] };
    }
    
    const reloadEvent: WeaponReloadEvent = {
      playerId,
      weaponType: player.weaponId,
      timestamp: Date.now()
    };
    
    const reloadResult = this.weaponSystem.handleWeaponReload(reloadEvent, player);
    if (!reloadResult.canReload) {
      console.log(`🔄 Reload failed for ${playerId}: ${reloadResult.error}`);
      return { success: false, events: [] };
    }
    
    const weapon = reloadResult.weapon!;
    const events = [
      { type: EVENTS.WEAPON_RELOAD, data: { playerId, weaponType: weapon.type, reloadTime: weapon.reloadTime } }
    ];
    
    return { success: true, events };
  }
  
  // Handle weapon switch
  handleWeaponSwitch(playerId: string, weaponType: string): { success: boolean; events: any[] } {
    const player = this.players.get(playerId);
    if (!player) {
      return { success: false, events: [] };
    }
    
    const switchEvent: WeaponSwitchEvent = {
      playerId,
      fromWeapon: player.weaponId,
      toWeapon: weaponType,
      timestamp: Date.now()
    };
    
    const switchResult = this.weaponSystem.handleWeaponSwitch(switchEvent, player);
    if (!switchResult.canSwitch) {
      console.log(`🔄 Switch failed for ${playerId}: ${switchResult.error}`);
      return { success: false, events: [] };
    }
    
    const events = [
      { type: EVENTS.WEAPON_SWITCHED, data: { playerId, fromWeapon: switchEvent.fromWeapon, toWeapon: switchEvent.toWeapon } }
    ];
    
    return { success: true, events };
  }
  
  // Handle grenade throw
  handleGrenadeThrow(event: GrenadeThrowEvent): { success: boolean; events: any[] } {
    const player = this.players.get(event.playerId);
    if (!player) {
      return { success: false, events: [] };
    }
    
    const throwResult = this.weaponSystem.handleGrenadeThrow(event, player);
    if (!throwResult.canThrow) {
      console.log(`💣 Grenade throw failed for ${event.playerId}: ${throwResult.error}`);
      return { success: false, events: [] };
    }
    
    const weapon = throwResult.weapon!;
    
    // Use new grenade velocity system with charge levels
    const baseSpeed = GAME_CONFIG.WEAPONS.GRENADE.BASE_THROW_SPEED;
    const chargeBonus = GAME_CONFIG.WEAPONS.GRENADE.CHARGE_SPEED_BONUS;
    const speed = baseSpeed + (event.chargeLevel * chargeBonus); // 8-32 px/s range
    const velocity = this.calculateProjectileVelocity(event.direction, speed);
    
    // Apply charge multiplier to range only (velocity already includes charge)
    const chargeMultiplier = 1 + ((event.chargeLevel - 1) * 0.5);
    
    const projectile = this.projectileSystem.createProjectile(
      'grenade',
      event.position,
      velocity,
      event.playerId,
      weapon.damage,
      {
        range: weapon.range * chargeMultiplier,
        explosionRadius: GAME_CONFIG.WEAPONS.GRENADE.EXPLOSION_RADIUS,
        chargeLevel: event.chargeLevel
      }
    );
    
    const events = [
      { type: EVENTS.GRENADE_THROWN, data: { playerId: event.playerId, chargeLevel: event.chargeLevel, ammoRemaining: weapon.currentAmmo } },
      { type: EVENTS.PROJECTILE_CREATED, data: projectile }
    ];
    
    return { success: true, events };
  }
  
  // Apply damage to player
  private applyPlayerDamage(player: PlayerState, damage: number, damageType: 'bullet' | 'explosion', sourcePlayerId: string, position: Vector2): PlayerDamageEvent {
    const newHealth = Math.max(0, player.health - damage);
    const isKilled = newHealth <= 0;
    
    player.health = newHealth;
    player.lastDamageTime = Date.now();
    
    if (isKilled) {
      player.isAlive = false;
      player.deaths++;
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
  private calculateProjectileVelocity(direction: number, speed: number): Vector2 {
    return {
      x: Math.cos(direction) * speed,
      y: Math.sin(direction) * speed
    };
  }
  
  private validateInput(playerId: string, input: InputState): boolean {
    // Check timestamp (prevent old/future inputs)
    const now = Date.now();
    const timeDiff = Math.abs(now - input.timestamp);
    
    if (timeDiff > 1000) { // 1 second tolerance
      console.warn(`⏰ Input rejected for ${playerId.substring(0, 8)}: timestamp diff ${timeDiff}ms`);
      return false;
    }
    
    // Check sequence number (prevent replay attacks)
    const lastSequence = this.lastInputSequence.get(playerId) || 0;
    if (input.sequence <= lastSequence) {
      // Be more lenient - allow some out-of-order packets
      if (input.sequence < lastSequence - 10) {
        console.warn(`🔢 Input rejected for ${playerId.substring(0, 8)}: sequence ${input.sequence} <= ${lastSequence}`);
        return false;
      }
    }
    
    // Validate input ranges - check both game space and screen space
    const isGameSpace = input.mouse.x <= GAME_CONFIG.GAME_WIDTH && input.mouse.y <= GAME_CONFIG.GAME_HEIGHT;
    const isScreenSpace = input.mouse.x <= GAME_CONFIG.GAME_WIDTH * GAME_CONFIG.SCALE_FACTOR && 
                          input.mouse.y <= GAME_CONFIG.GAME_HEIGHT * GAME_CONFIG.SCALE_FACTOR;
    
    if (!isGameSpace && !isScreenSpace) {
      console.warn(`🖱️ Input rejected for ${playerId.substring(0, 8)}: mouse out of bounds (${input.mouse.x}, ${input.mouse.y})`);
      return false;
    }
    
    if (input.mouse.buttons < 0 || input.mouse.buttons > 7) { // 3 bits for mouse buttons
      console.warn(`🖱️ Input rejected for ${playerId.substring(0, 8)}: invalid button state ${input.mouse.buttons}`);
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
    // Mouse coordinates are already in game space, no need to scale
    const deltaX = input.mouse.x - player.transform.position.x;
    const deltaY = input.mouse.y - player.transform.position.y;
    
    // Calculate angle in radians
    const angle = Math.atan2(deltaY, deltaX);
    
    // Debug: Log rotation calculation occasionally
    if (Math.random() < 0.01) { // 1% chance to avoid spam
      console.log(`🎯 ROTATION ${player.id.substring(0, 8)}: mouse(${input.mouse.x.toFixed(1)}, ${input.mouse.y.toFixed(1)}) - player(${player.transform.position.x.toFixed(1)}, ${player.transform.position.y.toFixed(1)}) = angle ${(angle * 180 / Math.PI).toFixed(1)}°`);
    }
    
    player.transform.rotation = angle;
  }
  
  // Legacy shoot handler (keeping for compatibility)
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
    
    // Update projectile system - now with wall collision checking
    const projectileEvents = this.projectileSystem.update(deltaTime, this.destructionSystem.getWalls());
    
    // Queue projectile update events
    for (const updateEvent of projectileEvents.updateEvents) {
      this.pendingProjectileEvents.push({ type: EVENTS.PROJECTILE_UPDATED, data: updateEvent });
    }
    
    // Queue projectile explode events
    for (const explodeEvent of projectileEvents.explodeEvents) {
      this.pendingProjectileEvents.push({ type: EVENTS.PROJECTILE_EXPLODED, data: explodeEvent });
    }
    
    // Check projectile collisions
    this.checkProjectileCollisions();
    
    // Process explosions
    this.processExplosions();
    
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
  
  // Check projectile collisions
  private checkProjectileCollisions(): void {
    const projectiles = this.projectileSystem.getProjectiles();
    const wallDamageEvents: any[] = [];
    
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
        if (projectile.type === ('grenade' as any)) {
          continue;
        }
        
        const projectileDamageEvent = this.projectileSystem.handleWallCollision(projectile, wallCollision.wall, wallCollision.sliceIndex);
        if (projectileDamageEvent) {
          const wallDamageResult = this.destructionSystem.applyDamage(wallCollision.wall.id, wallCollision.sliceIndex, projectileDamageEvent.damage);
          
          // CRITICAL FIX: Store events for broadcasting
          if (wallDamageResult) {
            wallDamageEvents.push({ type: EVENTS.WALL_DAMAGED, data: wallDamageResult });
            
            if (wallDamageResult.isDestroyed) {
              wallDamageEvents.push({ type: EVENTS.WALL_DESTROYED, data: wallDamageResult });
            }
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
  
  // Process explosions
  private processExplosions(): void {
    const explosionResults = this.projectileSystem.processExplosions(this.players, this.destructionSystem.getWalls());
    const explosionWallDamageEvents: any[] = [];
    
    // Apply player damage from explosions
    for (const damageEvent of explosionResults.playerDamageEvents) {
      const player = this.players.get(damageEvent.playerId);
      if (player) {
        this.applyPlayerDamage(player, damageEvent.damage, damageEvent.damageType, damageEvent.sourcePlayerId, damageEvent.position);
      }
    }
    
    // Apply wall damage from explosions
    for (const damageEvent of explosionResults.wallDamageEvents) {
      const wallDamageResult = this.destructionSystem.applyDamage(damageEvent.wallId, damageEvent.sliceIndex, damageEvent.damage);
      
      // CRITICAL FIX: Collect explosion wall damage events
      if (wallDamageResult) {
        explosionWallDamageEvents.push({ type: EVENTS.WALL_DAMAGED, data: wallDamageResult });
        
        if (wallDamageResult.isDestroyed) {
          explosionWallDamageEvents.push({ type: EVENTS.WALL_DESTROYED, data: wallDamageResult });
        }
      }
    }
    
    // Broadcast explosion events
    for (const explosion of explosionResults.explosions) {
      explosionWallDamageEvents.push({ type: EVENTS.EXPLOSION_CREATED, data: explosion });
    }
    
    // Merge with pending events
    this.pendingWallDamageEvents.push(...explosionWallDamageEvents);
  }
  
  // Get pending events that need to be broadcast
  getPendingEvents(): any[] {
    const events = [
      ...this.pendingWallDamageEvents,
      ...this.pendingReloadCompleteEvents,
      ...this.pendingProjectileEvents
    ];
    this.pendingWallDamageEvents = [];
    this.pendingReloadCompleteEvents = [];
    this.pendingProjectileEvents = [];
    return events;
  }
  
  getState(): GameState {
    // Convert Map to plain object for JSON serialization
    const playersObject: { [key: string]: PlayerState } = {};
    for (const [id, player] of this.players) {
      // Convert weapons Map to plain object
      const weaponsObject: { [key: string]: any } = {};
      for (const [weaponId, weapon] of player.weapons) {
        weaponsObject[weaponId] = weapon;
      }
      
      playersObject[id] = {
        ...player,
        weapons: weaponsObject as any, // Cast to maintain interface compatibility
        lastProcessedInput: player.lastProcessedInput || 0 // Include for client prediction
      };
    }
    
    // Convert walls Map to plain object
    const wallsObject: { [key: string]: any } = {};
    for (const [wallId, wall] of this.destructionSystem.getWalls()) {
      wallsObject[wallId] = {
        ...wall,
        destructionMask: Array.from(wall.destructionMask) // Convert Uint8Array to regular array
      };
    }
    
    return {
      players: playersObject as any, // Cast to maintain interface compatibility
      walls: wallsObject as any,
      projectiles: this.projectileSystem.getProjectiles(),
      timestamp: Date.now(),
      tickRate: GAME_CONFIG.TICK_RATE
    };
  }
  
  getPlayerBody(playerId: string): Matter.Body | undefined {
    return this.playerBodies.get(playerId);
  }
  
  // Get weapon system (for external access)
  getWeaponSystem(): WeaponSystem {
    return this.weaponSystem;
  }
  
  // Get projectile system (for external access)
  getProjectileSystem(): ProjectileSystem {
    return this.projectileSystem;
  }
  
  // Get destruction system (for external access)
  getDestructionSystem(): DestructionSystem {
    return this.destructionSystem;
  }
}
