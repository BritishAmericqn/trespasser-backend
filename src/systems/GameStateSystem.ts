import { GameState, PlayerState, InputState, WeaponState, WeaponType, WeaponFireEvent, WeaponReloadEvent, WeaponSwitchEvent, GrenadeThrowEvent, PlayerDamageEvent, WallDamageEvent, Vector2 } from '../../shared/types';
import { GAME_CONFIG, EVENTS } from '../../shared/constants';
import { PhysicsSystem } from './PhysicsSystem';
import { WeaponSystem } from './WeaponSystem';
import { ProjectileSystem } from './ProjectileSystem';
import { DestructionSystem } from './DestructionSystem';
import { VisibilityPolygonSystem } from './VisibilityPolygonSystem';
import { WeaponDiagnostics } from './WeaponDiagnostics';
import Matter from 'matter-js';
import { calculateSliceIndex, isPointInSlice } from '../utils/wallSliceHelpers';

export class GameStateSystem {
  private players: Map<string, PlayerState> = new Map();
  private playerBodies: Map<string, Matter.Body> = new Map();
  private lastUpdateTime: number = Date.now();
  private physics: PhysicsSystem;
  private weaponSystem: WeaponSystem;
  private projectileSystem: ProjectileSystem;
  private destructionSystem: DestructionSystem;
  private visionSystem: VisibilityPolygonSystem;
  private lastInputSequence: Map<string, number> = new Map();
  private pendingWallDamageEvents: any[] = [];
  private pendingReloadCompleteEvents: any[] = [];
  private pendingProjectileEvents: any[] = [];
  private pendingDeathEvents: any[] = [];

  private wallsUpdatedThisTick: boolean = false;
  private visionUpdateCounter: number = 0;
  private spawnPositions: { red: Vector2[], blue: Vector2[] } = { red: [], blue: [] };
  
  constructor(physics: PhysicsSystem) {
    this.physics = physics;
    
    // Initialize systems
    this.destructionSystem = new DestructionSystem(physics);
    this.weaponSystem = new WeaponSystem();
    this.projectileSystem = new ProjectileSystem(physics, this.weaponSystem, this.destructionSystem);
    
    // Initialize polygon vision system
    this.visionSystem = new VisibilityPolygonSystem();
    
    // Don't initialize walls here - will be done in initialize()
    
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
    
    // Set up machine gun heat update callback
    this.weaponSystem.setHeatUpdateCallback((event) => {
      this.pendingProjectileEvents.push({
        type: EVENTS.WEAPON_HEAT_UPDATE,
        data: event
      });
    });
    
    // console.log('GameStateSystem initialized with weapon and vision systems');
  }
  
  async initialize(): Promise<void> {
    // Initialize destruction system (loads map if specified)
    await this.destructionSystem.initialize();
    
    // Now initialize walls in vision system
    this.initializeWalls();
  }
  
  private initializeWalls(): void {
    // Get walls from destruction system and pass to vision system
    const walls = this.destructionSystem.getWalls();
    console.log(`🧱 Initializing ${walls.size} walls for GameStateSystem`);
    
    const wallData = Array.from(walls.entries()).map(([id, wall]) => ({
      id: id,
      x: wall.position.x,
      y: wall.position.y,
      width: wall.width,
      height: wall.height,
      material: wall.material,
      sliceHealth: [...wall.sliceHealth],
      maxHealth: wall.maxHealth,
      destructionMask: Array.from(wall.destructionMask) // Pass destruction mask for partial walls
    }));
    this.visionSystem.initializeWalls(wallData);
    
    // Get spawn positions from destruction system (if loaded from map)
    const spawns = this.destructionSystem.getSpawnPositions();
    if (spawns.length > 0) {
      this.setSpawnPositions(spawns);
    }
    
    // CRITICAL: Get team-specific spawn positions
    const teamSpawns = this.destructionSystem.getTeamSpawnPositions();
    if (teamSpawns.red.length > 0 || teamSpawns.blue.length > 0) {
      this.spawnPositions = teamSpawns;
      console.log(`📍 Set team spawn positions - Red: ${teamSpawns.red.length}, Blue: ${teamSpawns.blue.length}`);
    }
  }
  
  setSpawnPositions(spawns: Vector2[]): void {
    // Reset spawn arrays
    this.spawnPositions.red = [];
    this.spawnPositions.blue = [];
    
    // Alternate between red and blue teams
    spawns.forEach((spawn, index) => {
      if (index % 2 === 0) {
        this.spawnPositions.red.push(spawn);
      } else {
        this.spawnPositions.blue.push(spawn);
      }
    });
    
    console.log(`📍 Set spawn positions - Red: ${this.spawnPositions.red.length}, Blue: ${this.spawnPositions.blue.length}`);
  }
  
  createPlayer(id: string): PlayerState {
    // Don't create default weapons - frontend will send weapon:equip event
    
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
      team: 'red', // Default to red, will be updated by frontend in player:join
      weaponId: '', // No default weapon
      weapons: new Map(), // Empty weapons map - will be populated by weapon:equip
      isAlive: true,
      movementState: 'idle',
      isADS: false,
      lastDamageTime: 0,
      kills: 0,
      deaths: 0
    };
    
    // Debug weapon initialization
    console.log(`\n🎮 [PLAYER CREATED] ${id}`);
    console.log(`   No default weapons - waiting for weapon:equip event from frontend`);
    console.log(`🎨 [TEAM DEBUG] Player ${id.substring(0, 8)} created with default team: ${player.team}`);
    
    // Try to use spawn positions from map if available
    const teamSpawns = this.spawnPositions[player.team];
    console.log(`📍 [SPAWN] Player ${id.substring(0, 8)} team: ${player.team}`);
    console.log(`   Available spawns: Red=${this.spawnPositions.red.length}, Blue=${this.spawnPositions.blue.length}`);
    
    if (teamSpawns && teamSpawns.length > 0) {
      // Pick a random spawn from team spawns
      const spawn = teamSpawns[Math.floor(Math.random() * teamSpawns.length)];
      // CRITICAL: Create proper deep copy to prevent reference sharing
      player.transform.position = { x: spawn.x, y: spawn.y };
      console.log(`   ✅ Using ${player.team} team spawn: (${spawn.x}, ${spawn.y})`);
    } else {
      console.log(`   ⚠️ No ${player.team} team spawns available, using random position`);
      // Fall back to finding a safe spawn position
      let spawnAttempts = 0;
      while (spawnAttempts < 10 && !this.canPlayerMoveTo(id, player.transform.position)) {
        // Try different spawn positions
        player.transform.position.x = 50 + Math.random() * (GAME_CONFIG.GAME_WIDTH - 100);
        player.transform.position.y = 50 + Math.random() * (GAME_CONFIG.GAME_HEIGHT - 100);
        spawnAttempts++;
      }
      
      if (spawnAttempts >= 10) {
        console.warn(`   ❌ Could not find valid spawn position after 10 attempts!`);
      } else {
        console.log(`   📍 Using random spawn: (${player.transform.position.x.toFixed(0)}, ${player.transform.position.y.toFixed(0)})`);
      }
    }
    
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
    
    // Debug logs disabled for performance
    // console.log(`🔧 CREATING PLAYER BODY at position: (${player.transform.position.x}, ${player.transform.position.y})`);
    // console.log(`🎮 PLAYER SPAWNED: ${id} at (${player.transform.position.x}, ${player.transform.position.y})`);
    this.physics.addBody(body);
    this.playerBodies.set(id, body);
    
    // console.log(`🔧 PHYSICS BODY CREATED at: (${body.position.x}, ${body.position.y})`);
    // console.log(`🔧 PHYSICS BODY AFTER ADDING TO WORLD: (${body.position.x}, ${body.position.y})`);
    
    this.players.set(id, player);
    this.lastInputSequence.set(id, 0);
    
    // DEBUG: DISABLED FOR PERFORMANCE - this was creating intervals for every player!
    // setInterval(() => {
    //   const currentPlayer = this.players.get(id);
    //   if (currentPlayer && currentPlayer.isAlive) {
    //     console.log(`📍 POSITION CHECK ${id.substring(0, 8)}: (${currentPlayer.transform.position.x.toFixed(2)}, ${currentPlayer.transform.position.y.toFixed(2)}) | vel: (${currentPlayer.velocity.x.toFixed(2)}, ${currentPlayer.velocity.y.toFixed(2)}) | state: ${currentPlayer.movementState}`);
    //   }
    // }, 1000);
    
    return player;
  }
  
  getPlayer(id: string): PlayerState | undefined {
    return this.players.get(id);
  }
  
  getPlayers(): Map<string, PlayerState> {
    return this.players;
  }
  
  removePlayer(id: string): void {
    const body = this.playerBodies.get(id);
    if (body) {
      this.physics.removeBody(body);
      this.playerBodies.delete(id);
    }
    
    // Get player before removing for cleanup
    const player = this.players.get(id);
    
    // Clean up all player-related state
    this.players.delete(id);
    this.lastInputSequence.delete(id);
    
    // Clean up vision state
    this.visionSystem.removePlayer(id);
    
    // CRITICAL FIX: Clean up weapon system state
    if (player) {
      // Clear the player's weapons Map completely to prevent reference sharing
      player.weapons.clear();
    }
    
    // CRITICAL FIX: Clean up projectiles owned by this player
    const projectiles = this.projectileSystem.getProjectiles();
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const projectile = projectiles[i];
      if (projectile.ownerId === id) {
        this.projectileSystem.removeProjectile(projectile.id);
      }
    }
    
    console.log(`🧹 [CLEANUP] Player ${id.substring(0, 8)} completely removed with all associated state`);
  }
  
  // Respawn player at correct team spawn position
  respawnPlayerAtTeamSpawn(playerId: string): void {
    const player = this.players.get(playerId);
    if (!player) return;
    
    // 🎨 DEBUG: Verify team persistence
    console.log(`🎨 [TEAM SPAWN] Player ${playerId.substring(0, 8)} respawning:`);
    console.log(`   Stored team: ${player.team}`);
    console.log(`   Available spawns: Red=${this.spawnPositions.red.length}, Blue=${this.spawnPositions.blue.length}`);
    
    const teamSpawns = this.spawnPositions[player.team];
    if (teamSpawns && teamSpawns.length > 0) {
      // Pick a random spawn from team spawns
      const spawn = teamSpawns[Math.floor(Math.random() * teamSpawns.length)];
      player.transform.position = { x: spawn.x, y: spawn.y };
      
      // Update physics body position
      const body = this.playerBodies.get(playerId);
      if (body) {
        Matter.Body.setPosition(body, { x: spawn.x, y: spawn.y });
      }
      
      console.log(`🎯 Respawned ${playerId.substring(0, 8)} at team ${player.team} spawn: (${spawn.x}, ${spawn.y})`);
    } else {
      console.warn(`⚠️ No ${player.team} team spawns available for player ${playerId.substring(0, 8)}`);
    }
  }
  
  // Handle player respawning
  private handleRespawning(): void {
    const now = Date.now();
    
    for (const [playerId, player] of this.players) {
      if (!player.isAlive && player.respawnTime && now >= player.respawnTime) {
        // Time to respawn
        this.respawnPlayer(playerId);
      }
    }
  }
  
  // Respawn a dead player
  respawnPlayer(playerId: string): void {
    const player = this.players.get(playerId);
    if (!player || player.isAlive) return;
    
    const now = Date.now();
    
    // Reset player state
    player.isAlive = true;
    player.health = GAME_CONFIG.PLAYER_HEALTH;
    player.deathTime = undefined;
    player.respawnTime = undefined;
    player.killerId = undefined;
    player.invulnerableUntil = now + GAME_CONFIG.DEATH.INVULNERABILITY_TIME;
    
    // Respawn at team spawn
    this.respawnPlayerAtTeamSpawn(playerId);
    
    console.log(`🔄 Player ${playerId.substring(0, 8)} respawned with ${GAME_CONFIG.DEATH.INVULNERABILITY_TIME}ms invulnerability`);
    
    // Queue respawn event
    this.pendingDeathEvents.push({
      type: EVENTS.PLAYER_RESPAWNED,
      data: {
        playerId: player.id,
        position: { ...player.transform.position },
        team: player.team,
        invulnerableUntil: player.invulnerableUntil,
        timestamp: now
      }
    });
  }
  
  // Debug method to kill a player for testing
  debugKillPlayer(playerId: string): void {
    const player = this.players.get(playerId);
    if (player && player.isAlive) {
      this.applyPlayerDamage(player, 999, 'explosion', 'debug', player.transform.position);
    }
  }
  
  handlePlayerInput(playerId: string, input: InputState): void {
    const player = this.players.get(playerId);
    const body = this.playerBodies.get(playerId);
    
    if (!player || !body) return;
    
    // Allow some input from dead players (for spectating, respawn requests)
    if (!player.isAlive) {
      // Dead players can still rotate camera/aim
      this.updatePlayerRotation(player, input);
      return;
    }
    
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
    
    // Debug: DISABLED FOR PERFORMANCE
    // if (beforePos.x !== player.transform.position.x || beforePos.y !== player.transform.position.y) {
    //   console.log(`🎮 INPUT ${playerId.substring(0, 8)} seq:${input.sequence} | before: (${beforePos.x.toFixed(2)}, ${beforePos.y.toFixed(2)}) → after: (${player.transform.position.x.toFixed(2)}, ${player.transform.position.y.toFixed(2)}) | keys: ${Object.entries(input.keys).filter(([k, v]) => v).map(([k]) => k).join(',')}`);
    // }
  }
  
  private handleWeaponInputs(playerId: string, input: InputState): void {
    const player = this.players.get(playerId);
    if (!player) return;
    
    // Handle weapon firing
    if (input.mouse.leftPressed) {
      // Debug current weapon state before firing
      WeaponDiagnostics.logWeaponState(player);
      
      const weaponFireEvent: WeaponFireEvent = {
        playerId,
        weaponType: player.weaponId as WeaponType,
        position: { ...player.transform.position },
        direction: player.transform.rotation,
        isADS: player.isADS,
        timestamp: Date.now(),
        sequence: input.sequence,
        pelletCount: player.weaponId === 'shotgun' ? 8 : undefined
      };
      
      this.handleWeaponFire(weaponFireEvent);
    }
    
    // Handle weapon switching
    // Try to switch to primary weapon (key 1)
    if (input.keys['1']) {
      const primary = Array.from(player.weapons.keys()).find(w => 
        ['rifle', 'smg', 'shotgun', 'battlerifle', 'sniperrifle'].includes(w)
      );
      if (primary && player.weaponId !== primary) {
        this.handleWeaponSwitch(playerId, primary);
      }
    }
    
    // Try to switch to secondary weapon (key 2)
    if (input.keys['2']) {
      const secondary = Array.from(player.weapons.keys()).find(w =>
        ['pistol', 'revolver', 'suppressedpistol'].includes(w)
      );
      if (secondary && player.weaponId !== secondary) {
        this.handleWeaponSwitch(playerId, secondary);
      }
    }
    
    // Cycle through support weapons with keys 3-4
    const supportWeapons = Array.from(player.weapons.keys()).filter(w =>
      ['grenade', 'smokegrenade', 'flashbang', 'grenadelauncher', 'machinegun', 'antimaterialrifle', 'rocket'].includes(w)
    );
    
    if (input.keys['3'] && supportWeapons[0] && player.weaponId !== supportWeapons[0]) {
      this.handleWeaponSwitch(playerId, supportWeapons[0]);
    }
    if (input.keys['4'] && supportWeapons[1] && player.weaponId !== supportWeapons[1]) {
      this.handleWeaponSwitch(playerId, supportWeapons[1]);
    }
    
    // Handle reload
    if (input.keys.r) {
      this.handleWeaponReload(playerId);
    }
    
    // Handle grenade throwing
    if (input.keys.g) {
      const weapon = player.weapons.get(player.weaponId);
      if (weapon && ['grenade', 'smokegrenade', 'flashbang'].includes(weapon.type)) {
        // For now, treat G key as instant throw with charge level 3 for grenades, 1 for others
        const chargeLevel = weapon.type === 'grenade' ? 3 : 1;
        const grenadeThrowEvent: GrenadeThrowEvent = {
          playerId,
          position: { ...player.transform.position },
          direction: player.transform.rotation,
          chargeLevel: chargeLevel,
          timestamp: Date.now()
        };
        
        this.handleGrenadeThrow(grenadeThrowEvent);
      }
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
      
      // Debug: DISABLED FOR PERFORMANCE
      // if (Math.random() < 0.05) { // Log 5% of movements to avoid spam
      //   console.log(`🏃 MOVEMENT CALC ${playerId.substring(0, 8)}:`);
      //   console.log(`   Input: ${Object.entries(input.keys).filter(([k, v]) => v && ['w','a','s','d','shift','ctrl'].includes(k)).map(([k]) => k).join(',')}`);
      //   console.log(`   Movement vector: (${movementVector.x}, ${movementVector.y})`);
      //   console.log(`   Speed: base=${baseSpeed}, modifier=${speedModifier}, final=${finalSpeed}`);
      //   console.log(`   Delta: time=${deltaTime}ms, seconds=${deltaSeconds}`);
      //   console.log(`   Position delta: (${positionDelta.x.toFixed(4)}, ${positionDelta.y.toFixed(4)})`);
      // }
      
      // Calculate intended position
      const intendedPosition = {
        x: player.transform.position.x + positionDelta.x,
        y: player.transform.position.y + positionDelta.y
      };
      
      // Check if player can move to intended position
      if (this.canPlayerMoveTo(playerId, intendedPosition)) {
        player.transform.position = intendedPosition;
      } else {
        // Try sliding along walls
        const slidePosition = this.calculateSlidePosition(player.transform.position, intendedPosition);
        if (slidePosition) {
          player.transform.position = slidePosition;
          
          // Debug collision
          if (Math.random() < 0.1) { // 10% chance
            // console.log(`🧱 WALL SLIDE ${playerId.substring(0, 8)}: intended(${intendedPosition.x.toFixed(1)}, ${intendedPosition.y.toFixed(1)}) → slide(${slidePosition.x.toFixed(1)}, ${slidePosition.y.toFixed(1)})`);
          }
        } else {
          // Can't move at all - log collision
          if (Math.random() < 0.1) { // 10% chance
            // console.log(`🚫 BLOCKED ${playerId.substring(0, 8)}: at (${player.transform.position.x.toFixed(1)}, ${player.transform.position.y.toFixed(1)})`);
          }
        }
      }
      
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
      WeaponDiagnostics.logError('handleWeaponFire', `Player not found: ${event.playerId}`);
      return { success: false, events: [] };
    }
    
    WeaponDiagnostics.logEventSent('weapon:fire request', event);
    
    const fireResult = this.weaponSystem.handleWeaponFire(event, player);
    if (!fireResult.canFire) {
      return { success: false, events: [] };
    }
    
    const weapon = fireResult.weapon!;
    const weaponConfig = this.weaponSystem.getWeaponConfig(weapon.type);
    const events: any[] = [];
    
    // Check if this is a throwable weapon that should be converted to a throw event
    const throwableWeapons = ['grenade', 'smokegrenade', 'flashbang'];
    if (throwableWeapons.includes(weapon.type)) {
      console.log(`🔄 Converting fire event to throw event for ${weapon.type}`);
      // Convert to a grenade throw event with default charge level
      const grenadeThrowEvent: GrenadeThrowEvent = {
        playerId: event.playerId,
        position: event.position,
        direction: event.direction,
        chargeLevel: weapon.type === 'grenade' ? 3 : 1, // Default charge levels
        timestamp: event.timestamp
      };
      
      const throwResult = this.handleGrenadeThrow(grenadeThrowEvent);
      
      // Add weapon:fired event to the throw result events for frontend compatibility
      if (throwResult.success) {
        throwResult.events.push({ 
          type: EVENTS.WEAPON_FIRED, 
          data: { 
            playerId: event.playerId, 
            weaponType: weapon.type,
            position: event.position,
            direction: event.direction,
            ammoRemaining: weapon.currentAmmo  // Already decremented in handleGrenadeThrow
          }
        });
      }
      
      return throwResult;
    }
    
    // Handle hitscan weapons
    if (weaponConfig.HITSCAN) {
      // Special handling for shotgun
      if (weapon.type === 'shotgun') {
        const pelletCount = weaponConfig.PELLET_COUNT || 8;
        const pelletDirections = this.weaponSystem.generateShotgunPellets(event.direction, pelletCount);
        const damagePerPellet = weapon.damage / pelletCount;
        
        // Calculate offset position in front of player to prevent self-hits
        const playerRadius = GAME_CONFIG.PLAYER_SIZE / 2;
        const offsetDistance = playerRadius + 2; // Start pellets 2 pixels beyond player edge
        const offsetPosition = {
          x: event.position.x + Math.cos(event.direction) * offsetDistance,
          y: event.position.y + Math.sin(event.direction) * offsetDistance
        };
        
        console.log(`🔫 SHOTGUN DEBUG: Player ${event.playerId.substring(0, 8)}`);
        console.log(`   Player position: (${event.position.x.toFixed(2)}, ${event.position.y.toFixed(2)})`);
        console.log(`   Offset position: (${offsetPosition.x.toFixed(2)}, ${offsetPosition.y.toFixed(2)})`);
        console.log(`   Direction: ${event.direction.toFixed(3)} rad`);
        console.log(`   Offset distance: ${offsetDistance} pixels`);
        
        // Track all pellet hits for the event
        const allPelletHits: any[] = [];
        let selfHitCount = 0;
        
        for (let pelletIndex = 0; pelletIndex < pelletDirections.length; pelletIndex++) {
          const pelletDirection = pelletDirections[pelletIndex];
          const pelletHits = this.weaponSystem.performHitscanWithPenetration(
            offsetPosition, // Use offset position instead of player center
            pelletDirection,
            weapon.range,
            { ...weapon, damage: damagePerPellet }, // Temporary weapon with reduced damage
            player,
            this.destructionSystem.getWalls(),
            this.players
          );
          
          console.log(`  🎯 Pellet ${pelletIndex}: Direction ${pelletDirection.toFixed(3)}, ${pelletHits.length} hits`);
          
          // Track if this pellet hit anything at all
          let pelletHitSomething = false;
          
          // Process each pellet's hits
          for (const hit of pelletHits) {
            allPelletHits.push(hit);
            pelletHitSomething = true;
            
            // Check for self-hit (debugging)
            if (hit.targetType === 'player' && hit.targetId === event.playerId) {
              selfHitCount++;
              console.log(`🚨 SELF-HIT DETECTED! Pellet ${pelletIndex}, hit point: (${hit.hitPoint.x.toFixed(1)}, ${hit.hitPoint.y.toFixed(1)})`);
            }
            
            // Send individual pellet event based on hit type
            if (hit.targetType === 'player') {
              // Apply damage to the player
              const targetPlayer = this.players.get(hit.targetId);
              if (targetPlayer) {
                const damageEvent = this.applyPlayerDamage(targetPlayer, damagePerPellet, 'bullet', event.playerId, hit.hitPoint);
                events.push({ type: EVENTS.PLAYER_DAMAGED, data: damageEvent });
                
                if (damageEvent.isKilled) {
                  player.kills++;
                  events.push({ type: EVENTS.PLAYER_KILLED, data: damageEvent });
                }
              }
              
              // Send weapon:hit event for frontend trail
              events.push({
                type: EVENTS.WEAPON_HIT,
                data: {
                  playerId: event.playerId,
                  weaponType: weapon.type,
                  position: hit.hitPoint,
                  targetType: 'player',
                  targetId: hit.targetId,
                  pelletIndex: pelletIndex // Frontend needs this!
                }
              });
            } else if (hit.targetType === 'wall') {
              // Apply damage to the wall
              if (hit.wallSliceIndex !== undefined) {
                const wall = this.destructionSystem.getWall(hit.targetId);
                if (wall) {
                  const damageEvent = this.destructionSystem.applyDamage(hit.targetId, hit.wallSliceIndex, damagePerPellet);
                  
                  if (damageEvent) {
                    // Send wall:damaged event for destruction system
                    events.push({ type: EVENTS.WALL_DAMAGED, data: {
                      ...damageEvent,
                      weaponType: weapon.type,
                      material: wall.material || 'concrete',
                      playerId: event.playerId,
                      pelletIndex: pelletIndex
                    }});
                    
                    this.visionSystem.onWallDestroyed(hit.targetId, wall, damageEvent.sliceIndex);
                    
                    if (damageEvent.isDestroyed) {
                      events.push({ type: EVENTS.WALL_DESTROYED, data: {
                        ...damageEvent,
                        weaponType: weapon.type
                      }});
                    }
                  }
                }
              }
              
              // Send weapon:hit event for frontend trail
              events.push({
                type: EVENTS.WEAPON_HIT,
                data: {
                  playerId: event.playerId,
                  weaponType: weapon.type,
                  position: hit.hitPoint,
                  targetType: 'wall',
                  targetId: hit.targetId,
                  pelletIndex: pelletIndex // Frontend needs this!
                }
              });
            }
            
            // Pellets don't penetrate - break after first hit
            break;
          }
          
          // If this pellet didn't hit anything, send weapon:miss event
          if (!pelletHitSomething) {
            // Calculate where the pellet would end up if it traveled max range
            const missPosition = {
              x: offsetPosition.x + Math.cos(pelletDirection) * weapon.range,
              y: offsetPosition.y + Math.sin(pelletDirection) * weapon.range
            };
            
            events.push({
              type: EVENTS.WEAPON_MISS,
              data: {
                playerId: event.playerId,
                weaponType: weapon.type,
                position: missPosition,
                direction: pelletDirection,
                pelletIndex: pelletIndex // Frontend needs this!
              }
            });
            
            console.log(`  🎯 Pellet ${pelletIndex}: MISS - ended at (${missPosition.x.toFixed(1)}, ${missPosition.y.toFixed(1)})`);
          }
        }
        
        console.log(`🔫 SHOTGUN SUMMARY: ${allPelletHits.length} total hits, ${selfHitCount} self-hits`);
        if (selfHitCount > 0) {
          console.log(`🚨 WARNING: Shotgun self-hit detected despite offset position!`);
        }
        
        // Individual pellet events are now sent above - no need for summary event
        console.log(`📤 SENT ${pelletCount} INDIVIDUAL PELLET EVENTS instead of summary event`);
      } else {
        // Regular hitscan handling for other weapons
        const penetrationHits = this.weaponSystem.performHitscanWithPenetration(
          event.position,
          event.direction,
          weapon.range,
          weapon,
          player,
          this.destructionSystem.getWalls(),
          this.players
        );
        
          // Process all hits from penetration
          if (penetrationHits.length > 0) {
            for (const hit of penetrationHits) {
              if (hit.targetType === 'player') {
                // Player hit
                const targetPlayer = this.players.get(hit.targetId);
                if (targetPlayer) {
                  const damageEvent = this.applyPlayerDamage(targetPlayer, hit.damage, 'bullet', event.playerId, hit.hitPoint);
                  events.push({ type: EVENTS.PLAYER_DAMAGED, data: damageEvent });
                
                  if (damageEvent.isKilled) {
                    player.kills++;
                    events.push({ type: EVENTS.PLAYER_KILLED, data: damageEvent });
                  }
                }
              } else if (hit.targetType === 'wall' && hit.wallSliceIndex !== undefined) {
                // Wall hit
                const wall = this.destructionSystem.getWall(hit.targetId);
                if (wall) {
                  const damageEvent = this.destructionSystem.applyDamage(hit.targetId, hit.wallSliceIndex, hit.damage);
                
                  if (damageEvent) {
                    events.push({ type: EVENTS.WALL_DAMAGED, data: {
                      ...damageEvent,
                      weaponType: weapon.type,  // Frontend requires this
                      material: wall.material || 'concrete'  // Frontend requires this
                    }});
                  
                    // Notify vision system of wall destruction
                    this.visionSystem.onWallDestroyed(
                      hit.targetId,
                      wall,
                      damageEvent.sliceIndex
                    );
                  
                    if (damageEvent.isDestroyed) {
                      events.push({ type: EVENTS.WALL_DESTROYED, data: {
                        ...damageEvent,
                        weaponType: weapon.type
                      }});
                    }
                  }
                }
              }
            }
          
            // Use the first hit for the hit event
            const firstHit = penetrationHits[0];
            events.push({ type: EVENTS.WEAPON_HIT, data: { 
              playerId: event.playerId,
              weaponType: weapon.type,  // Frontend requires this
              position: firstHit.hitPoint,
              targetType: firstHit.targetType,
              targetId: firstHit.targetId,
              penetrationCount: penetrationHits.length
            }});
          } else {
            events.push({ type: EVENTS.WEAPON_MISS, data: { 
              playerId: event.playerId, 
              weaponType: weapon.type,  // Frontend requires this
              position: event.position,
              direction: event.direction
            }});
          }
      }
    } else {
      // Handle projectile weapons (grenade, rocket)
      let velocity: Vector2;
      let projectileOptions: any = {
        range: weapon.range,
        explosionRadius: weaponConfig.EXPLOSION_RADIUS
      };
      
      if (weapon.type === 'grenadelauncher') {
        // Grenade launcher uses arc trajectory
        velocity = this.calculateProjectileVelocity(event.direction, weaponConfig.PROJECTILE_SPEED);
        projectileOptions.fuseTime = GAME_CONFIG.WEAPONS.GRENADELAUNCHER.FUSE_TIME || 3000;
        projectileOptions.explosionRadius = weaponConfig.EXPLOSION_RADIUS;
      } else {
        // Regular projectile (rocket)
        velocity = this.calculateProjectileVelocity(event.direction, weaponConfig.PROJECTILE_SPEED);
        console.log(`🚀 Creating rocket projectile - speed: ${weaponConfig.PROJECTILE_SPEED}, damage: ${weapon.damage}`);
      }
      
      const projectile = this.projectileSystem.createProjectile(
        weapon.type as 'rocket' | 'grenadelauncher',
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
      // console.log(`🔄 Reload failed for ${playerId}: ${reloadResult.error}`);
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
    
    console.log(`🔄 Weapon switch attempt - player: ${playerId.substring(0, 8)}, from: ${player.weaponId}, to: ${weaponType}`);
    console.log(`   Available weapons: [${Array.from(player.weapons.keys()).join(', ')}]`);
    
    const switchEvent: WeaponSwitchEvent = {
      playerId,
      fromWeapon: player.weaponId,
      toWeapon: weaponType,
      timestamp: Date.now()
    };
    
    const switchResult = this.weaponSystem.handleWeaponSwitch(switchEvent, player);
    if (!switchResult.canSwitch) {
      console.log(`❌ Switch failed for ${playerId}: ${switchResult.error}`);
      return { success: false, events: [] };
    }
    
    console.log(`✅ Weapon switched successfully to ${weaponType}`);
    
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
      // console.log(`💣 Grenade throw failed for ${event.playerId}: ${throwResult.error}`);
      return { success: false, events: [] };
    }
    
    const weapon = throwResult.weapon!;
    const weaponConfig = this.weaponSystem.getWeaponConfig(weapon.type);
    
    // Calculate velocity based on weapon type
    let velocity: Vector2;
    let projectileOptions: any = {
      explosionRadius: weaponConfig.EXPLOSION_RADIUS
    };
    
    if (weapon.type === 'grenade') {
      // Use charge system for regular grenades - don't set fuseTime!
      const baseSpeed = GAME_CONFIG.WEAPONS.GRENADE.BASE_THROW_SPEED;
      const chargeBonus = GAME_CONFIG.WEAPONS.GRENADE.CHARGE_SPEED_BONUS;
      const speed = baseSpeed + (event.chargeLevel * chargeBonus);
      velocity = this.calculateProjectileVelocity(event.direction, speed);
      
      // Apply charge multiplier to range
      const chargeMultiplier = 1 + ((event.chargeLevel - 1) * 0.5);
      projectileOptions.range = weapon.range * chargeMultiplier;
      projectileOptions.chargeLevel = event.chargeLevel;
      projectileOptions.fuseTime = weaponConfig.FUSE_TIME; // 3 seconds
    } else {
      // Smoke grenades and flashbangs use fixed speed and fuse time
      velocity = this.calculateProjectileVelocity(event.direction, weaponConfig.PROJECTILE_SPEED);
      projectileOptions.range = weapon.range;
      projectileOptions.fuseTime = weaponConfig.FUSE_TIME;
    }
    
    const projectile = this.projectileSystem.createProjectile(
      weapon.type as 'grenade' | 'smokegrenade' | 'flashbang',
      event.position,
      velocity,
      event.playerId,
      weapon.damage,
      projectileOptions
    );
    
    // Debug log for grenades
    if (weapon.type === 'grenade') {
      console.log(`💣 Grenade created with fuseTime: ${projectileOptions.fuseTime}ms, range: ${projectileOptions.range}, damage: ${weapon.damage}`);
    }
    
    const events = [
      { type: EVENTS.GRENADE_THROWN, data: { 
        playerId: event.playerId, 
        weaponType: weapon.type,
        chargeLevel: event.chargeLevel, 
        ammoRemaining: weapon.currentAmmo 
      }},
      { type: EVENTS.PROJECTILE_CREATED, data: {
        id: projectile.id,
        type: projectile.type,
        playerId: projectile.ownerId,
        position: { x: projectile.position.x, y: projectile.position.y },
        velocity: { x: projectile.velocity.x, y: projectile.velocity.y },
        timestamp: projectile.timestamp
      }}
    ];
    
    return { success: true, events };
  }
  
  // Apply damage to player
  private applyPlayerDamage(player: PlayerState, damage: number, damageType: 'bullet' | 'explosion', sourcePlayerId: string, position: Vector2): PlayerDamageEvent {
    // Check invulnerability after respawn
    const now = Date.now();
    if (player.invulnerableUntil && now < player.invulnerableUntil) {
      console.log(`🛡️ Player ${player.id.substring(0, 8)} is invulnerable (${player.invulnerableUntil - now}ms remaining)`);
      return {
        playerId: player.id,
        damage: 0,
        damageType,
        sourcePlayerId,
        position,
        newHealth: player.health,
        isKilled: false,
        timestamp: now
      };
    }
    
    const newHealth = Math.max(0, player.health - damage);
    const isKilled = newHealth <= 0;
    
    player.health = newHealth;
    player.lastDamageTime = now;
    
    if (isKilled && player.isAlive) {
      // Mark player as dead
      player.isAlive = false;
      player.deaths++;
      player.deathTime = now;
      player.killerId = sourcePlayerId;
      player.respawnTime = now + GAME_CONFIG.DEATH.RESPAWN_DELAY;
      
      console.log(`💀 Player ${player.id.substring(0, 8)} killed by ${sourcePlayerId.substring(0, 8)} - respawn in ${GAME_CONFIG.DEATH.RESPAWN_DELAY}ms`);
      
      // Queue death event
      this.pendingDeathEvents.push({
        type: EVENTS.PLAYER_DIED,
        data: {
          playerId: player.id,
          killerId: sourcePlayerId,
          position: { ...position },
          damageType,
          team: player.team, // 🎨 Include team for frontend team damage rules
          timestamp: now
        }
      });
      
      // Award kill to source player
      const killer = this.players.get(sourcePlayerId);
      if (killer && killer.id !== player.id) {
        killer.kills++;
        console.log(`🎯 Kill credit: ${sourcePlayerId.substring(0, 8)} now has ${killer.kills} kills`);
      }
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
      // console.warn(`⏰ Input rejected for ${playerId.substring(0, 8)}: timestamp diff ${timeDiff}ms`);
      return false;
    }
    
    // Check sequence number (prevent replay attacks)
    const lastSequence = this.lastInputSequence.get(playerId) || 0;
    if (input.sequence <= lastSequence) {
      // Be more lenient - allow some out-of-order packets
      if (input.sequence < lastSequence - 10) {
        // console.warn(`🔢 Input rejected for ${playerId.substring(0, 8)}: sequence ${input.sequence} <= ${lastSequence}`);
        return false;
      }
    }
    
    // Validate input ranges - check both game space and screen space
    const isGameSpace = input.mouse.x <= GAME_CONFIG.GAME_WIDTH && input.mouse.y <= GAME_CONFIG.GAME_HEIGHT;
    const isScreenSpace = input.mouse.x <= GAME_CONFIG.GAME_WIDTH * GAME_CONFIG.SCALE_FACTOR && 
                          input.mouse.y <= GAME_CONFIG.GAME_HEIGHT * GAME_CONFIG.SCALE_FACTOR;
    
    if (!isGameSpace && !isScreenSpace) {
      // console.warn(`🖱️ Input rejected for ${playerId.substring(0, 8)}: mouse out of bounds (${input.mouse.x}, ${input.mouse.y})`);
      return false;
    }
    
    if (input.mouse.buttons < 0 || input.mouse.buttons > 7) { // 3 bits for mouse buttons
      // console.warn(`🖱️ Input rejected for ${playerId.substring(0, 8)}: invalid button state ${input.mouse.buttons}`);
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
    
    // Debug: DISABLED FOR PERFORMANCE
    // if (Math.random() < 0.01) { // 1% chance to avoid spam
    //   console.log(`🎯 ROTATION ${player.id.substring(0, 8)}: mouse(${input.mouse.x.toFixed(1)}, ${input.mouse.y.toFixed(1)}) - player(${player.transform.position.x.toFixed(1)}, ${player.transform.position.y.toFixed(1)}) = angle ${(angle * 180 / Math.PI).toFixed(1)}°`);
    // }
    
    player.transform.rotation = angle;
  }
  
  // Check if a player can move to a new position (no wall collision)
  private canPlayerMoveTo(playerId: string, newPosition: Vector2): boolean {
    const playerRadius = GAME_CONFIG.PLAYER_SIZE / 2;
    const walls = this.destructionSystem.getWalls();
    
    // Check each wall for collision
    for (const [wallId, wall] of walls) {
      // Skip boundary walls for now (they're outside the game area)
      if (wall.position.x < 0 || wall.position.y < 0 || 
          wall.position.x >= GAME_CONFIG.GAME_WIDTH || 
          wall.position.y >= GAME_CONFIG.GAME_HEIGHT) {
        continue;
      }
      
      // Check if player circle overlaps with wall rectangle
      const closestX = Math.max(wall.position.x, Math.min(newPosition.x, wall.position.x + wall.width));
      const closestY = Math.max(wall.position.y, Math.min(newPosition.y, wall.position.y + wall.height));
      
      const distanceX = newPosition.x - closestX;
      const distanceY = newPosition.y - closestY;
      const distanceSquared = distanceX * distanceX + distanceY * distanceY;
      
      if (distanceSquared < playerRadius * playerRadius) {
        // Check if any slice in this wall is intact
        const closestPoint = { x: closestX, y: closestY };
        
        // Find which slice the collision point is in
        const sliceIndex = calculateSliceIndex(wall, closestPoint);
        
        // Check if the slice is intact
        if (sliceIndex >= 0 && sliceIndex < GAME_CONFIG.DESTRUCTION.WALL_SLICES && 
            wall.destructionMask[sliceIndex] === 0) {
          return false; // Collision detected with intact slice
        }
        
        // Also check adjacent slices for edge cases
        for (let i = Math.max(0, sliceIndex - 1); i <= Math.min(GAME_CONFIG.DESTRUCTION.WALL_SLICES - 1, sliceIndex + 1); i++) {
          if (wall.destructionMask[i] === 0 && isPointInSlice(wall, closestPoint, i)) {
            return false; // Collision with adjacent intact slice
          }
        }
      }
    }
    
    return true; // No collision
  }
  
  // Calculate slide position when hitting a wall
  private calculateSlidePosition(currentPos: Vector2, intendedPos: Vector2): Vector2 | null {
    const deltaX = intendedPos.x - currentPos.x;
    const deltaY = intendedPos.y - currentPos.y;
    
    // Try sliding along X axis
    const slideX = { x: intendedPos.x, y: currentPos.y };
    if (this.canPlayerMoveTo('', slideX)) {
      return slideX;
    }
    
    // Try sliding along Y axis
    const slideY = { x: currentPos.x, y: intendedPos.y };
    if (this.canPlayerMoveTo('', slideY)) {
      return slideY;
    }
    
    return null; // Can't slide
  }

  // Legacy shoot handler (keeping for compatibility)
  handlePlayerShoot(playerId: string, data: any): void {
    const player = this.players.get(playerId);
    if (!player || !player.isAlive) return;
    
    // TODO: Implement shooting logic
    // console.log(`Player ${playerId} shooting with weapon ${player.weaponId}`);
    
    // Create projectile based on player position and rotation
    // This would integrate with a ProjectileSystem
  }
  
  update(delta: number): void {
    const now = Date.now();
    const deltaTime = now - this.lastUpdateTime;
    this.lastUpdateTime = now;
    
    // Reset wall update flag
    this.wallsUpdatedThisTick = false;
    
    // Update machine gun cooling for all players
    for (const [playerId, player] of this.players) {
      if (player.isAlive) {
        this.weaponSystem.cooldownMachineGuns(player.weapons, deltaTime);
      }
    }

    // Handle player respawning
    this.handleRespawning();
    
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
    
    // Process explosions and queue damage events
    this.processExplosions();
    
    // Update player positions and sync with physics bodies
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
      
      // Sync Matter.js body with player position
      const body = this.playerBodies.get(playerId);
      if (body) {
        Matter.Body.setPosition(body, {
          x: player.transform.position.x,
          y: player.transform.position.y
        });
      }
      
      // Update movement state based on velocity
      const speed = Math.sqrt(player.velocity.x * player.velocity.x + player.velocity.y * player.velocity.y);
      if (speed < 10) {
        player.movementState = 'idle';
      }
      
      // console.log(`🔍 FINAL PLAYER POSITION for ${playerId}: (${player.transform.position.x.toFixed(2)}, ${player.transform.position.y.toFixed(2)}) | velocity=(${player.velocity.x.toFixed(2)}, ${player.velocity.y.toFixed(2)})`);
    }
    
    // Update vision with new tile-based system (only for alive players)
    for (const [playerId, player] of this.players) {
      if (!player.isAlive) continue;
      
      // Update vision using raycast for better gap detection
      const visibleTilesSet = this.visionSystem.updatePlayerVisionRaycast(player);
      
      // Vision data is now handled by polygon system
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
            
            // Notify vision system of wall destruction
            this.visionSystem.onWallDestroyed(
              wallCollision.wall.id,
              wallCollision.wall,
              wallDamageResult.sliceIndex
            );
            
            // Mark that walls were updated this tick
            this.wallsUpdatedThisTick = true;
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
  
  // Process explosions and queue damage events
  private processExplosions(): void {
    const explosionResults = this.projectileSystem.processExplosions(this.players, this.destructionSystem.getWalls());
    
    // Queue player damage events
    for (const damageEvent of explosionResults.playerDamageEvents) {
      console.log(`🎯 Applying explosion damage to player ${damageEvent.playerId}: ${damageEvent.damage} damage`);
      this.applyPlayerDamage(
        this.players.get(damageEvent.playerId)!,
        damageEvent.damage,
        damageEvent.damageType,
        damageEvent.sourcePlayerId,
        damageEvent.position
      );
    }
    
    // Queue wall damage events
    for (const wallDamageEvent of explosionResults.wallDamageEvents) {
      // Actually apply the damage to the wall!
      const actualDamageResult = this.destructionSystem.applyDamage(
        wallDamageEvent.wallId, 
        wallDamageEvent.sliceIndex, 
        wallDamageEvent.damage
      );
      
      if (actualDamageResult) {
        this.pendingWallDamageEvents.push({ type: EVENTS.WALL_DAMAGED, data: actualDamageResult });
        
        if (actualDamageResult.isDestroyed) {
          this.pendingWallDamageEvents.push({ type: EVENTS.WALL_DESTROYED, data: actualDamageResult });
        }
        
        // Notify vision system of wall destruction
        const wall = this.destructionSystem.getWall(wallDamageEvent.wallId);
        if (wall) {
          this.visionSystem.onWallDestroyed(
            wallDamageEvent.wallId,
            wall,
            actualDamageResult.sliceIndex
          );
        }
        
        // Mark that walls were updated
        this.wallsUpdatedThisTick = true;
      }
    }
    
    // Queue explosion events
    for (const explosion of explosionResults.explosions) {
      this.pendingProjectileEvents.push({ type: EVENTS.EXPLOSION_CREATED, data: explosion });
    }
  }
  
  // Get pending events that need to be broadcast
  getPendingEvents(): any[] {
    const events = [
      ...this.pendingWallDamageEvents,
      ...this.pendingReloadCompleteEvents,
      ...this.pendingProjectileEvents,
      ...this.pendingDeathEvents
    ];
    this.pendingWallDamageEvents = [];
    this.pendingReloadCompleteEvents = [];
    this.pendingProjectileEvents = [];
    this.pendingDeathEvents = [];
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
        id: player.id,
        // CRITICAL: Flatten transform for frontend compatibility
        position: player.transform.position,
        rotation: player.transform.rotation,
        scale: player.transform.scale,
        velocity: player.velocity,
        health: player.health,
        armor: player.armor,
        team: player.team,
        weaponId: player.weaponId,
        weapons: weaponsObject as any,
        isAlive: player.isAlive,
        movementState: player.movementState,
        isADS: player.isADS,
        lastDamageTime: player.lastDamageTime,
        kills: player.kills,
        deaths: player.deaths,
        lastProcessedInput: player.lastProcessedInput || 0,
        // Death and respawn fields
        deathTime: player.deathTime,
        respawnTime: player.respawnTime,
        invulnerableUntil: player.invulnerableUntil,
        killerId: player.killerId,
        // Keep transform for backward compatibility
        transform: player.transform
      } as any;
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
  
  // Get filtered game state for a specific player based on vision
  getFilteredGameState(playerId: string): GameState {
    // TEMP: Vision disabled - return all game state
    const player = this.players.get(playerId);
    
    if (!player) {
      // Return minimal state if no player
      return {
        players: {} as any,
        projectiles: [],
        walls: {} as any,
        timestamp: Date.now(),
        tickRate: GAME_CONFIG.TICK_RATE
      };
    }
    
    // TEMP: Return all players since vision is disabled
    const visiblePlayersObject: { [key: string]: PlayerState } = {};
    
    // 🎨 DEBUG: Track team data being sent
    let teamDataDebugLog = `🎨 Game state for ${playerId.substring(0, 8)} - Team data:`;
    
    // Include all players (alive and dead - dead players shown as corpses/ghosts)
    for (const [pid, p] of this.players) {
      
      const weaponsObject: { [key: string]: any } = {};
      for (const [weaponId, weapon] of p.weapons) {
        weaponsObject[weaponId] = weapon;
      }
      
      visiblePlayersObject[pid] = {
        id: p.id,
        // CRITICAL: Flatten transform for frontend compatibility
        position: p.transform.position,
        rotation: p.transform.rotation,
        scale: p.transform.scale,
        velocity: p.velocity,
        health: p.health,
        armor: p.armor,
        team: p.team,
        weaponId: p.weaponId,
        weapons: weaponsObject as any,
        isAlive: p.isAlive,
        movementState: p.movementState,
        isADS: p.isADS,
        lastDamageTime: p.lastDamageTime,
        kills: p.kills,
        deaths: p.deaths,
        lastProcessedInput: p.lastProcessedInput || 0,
        // Death and respawn fields
        deathTime: p.deathTime,
        respawnTime: p.respawnTime,
        invulnerableUntil: p.invulnerableUntil,
        killerId: p.killerId,
        // Keep transform for backward compatibility
        transform: p.transform
      } as any;
      
      // 🎨 DEBUG: Add to team data log
      teamDataDebugLog += ` ${pid.substring(0, 8)}=${p.team}`;
    }
    
    // 🎨 DEBUG: Log team data every 100th update to avoid spam
    if (Math.random() < 0.01) { // 1% chance to log
      console.log(teamDataDebugLog);
    }
    
    // TEMP: Return all projectiles since vision is disabled
    const allProjectiles = this.projectileSystem.getProjectiles();
    const visibleProjectiles = allProjectiles;
    
    // Get all walls (client will handle vision masking) - convert to plain object
    const wallsObject: { [key: string]: any } = {};
    for (const [wallId, wall] of this.destructionSystem.getWalls()) {
      wallsObject[wallId] = {
        ...wall,
        destructionMask: Array.from(wall.destructionMask)
      };
    }
    
    return {
      players: visiblePlayersObject as any,
      projectiles: visibleProjectiles,
      walls: wallsObject as any,
      timestamp: Date.now(),
      tickRate: GAME_CONFIG.TICK_RATE,
      // Include polygon vision data
      vision: player ? (() => {
        const visionData = this.visionSystem.getVisibilityData(player);
        return {
          type: 'polygon',
          polygon: visionData.polygon,
          viewAngle: visionData.viewAngle,
          viewDirection: visionData.viewDirection,
          viewDistance: visionData.viewDistance,
          position: player.transform.position,
          fogOpacity: GAME_CONFIG.VISION.FOG_OPACITY // Send fog opacity to frontend
        };
      })() : undefined
    };
  }
  
  // Get full game state (for spectators or debugging)
  getFullGameState(): GameState {
    return this.getState();
  }
}
