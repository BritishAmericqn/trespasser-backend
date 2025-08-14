import { 
  PlayerState, 
  WeaponState, 
  WeaponType,
  HitscanResult, 
  ProjectileState, 
  Vector2,
  WeaponFireEvent,
  WeaponHitEvent,
  WeaponReloadEvent,
  WeaponSwitchEvent,
  GrenadeThrowEvent,
  PenetrationHit,
  WeaponHeatUpdateEvent
} from '../../shared/types';
import { GAME_CONFIG, EVENTS } from '../../shared/constants';
import { 
  calculateSliceIndex,
  getSliceDimension,
  isHardWall
} from '../utils/wallSliceHelpers';
import { WeaponDiagnostics } from './WeaponDiagnostics';

export class WeaponSystem {
  private weapons: Map<string, WeaponState> = new Map();
  private projectileId: number = 0;
  
  constructor() {
    // console.log('WeaponSystem initialized');
  }
  
  // Initialize player weapons based on loadout
  initializePlayerWeapons(
    playerId: string, 
    loadout?: {
      primary?: WeaponType;
      secondary?: WeaponType;
      support?: WeaponType[];
    }
  ): Map<string, WeaponState> {
    const playerWeapons = new Map<string, WeaponState>();
    
    // Default loadout if none provided
    const defaultLoadout = {
      primary: 'rifle' as WeaponType,
      secondary: 'pistol' as WeaponType,
      support: ['grenade'] as WeaponType[]
    };
    
    const finalLoadout = loadout || defaultLoadout;
    
    // Validate and create primary weapon
    if (finalLoadout.primary) {
      const config = this.getWeaponConfig(finalLoadout.primary);
      if (config) {
        const weapon = this.createWeapon(finalLoadout.primary, config);
        playerWeapons.set(finalLoadout.primary, weapon);
      }
    }
    
    // Validate and create secondary weapon
    if (finalLoadout.secondary) {
      const config = this.getWeaponConfig(finalLoadout.secondary);
      if (config) {
        const weapon = this.createWeapon(finalLoadout.secondary, config);
        playerWeapons.set(finalLoadout.secondary, weapon);
      }
    }
    
    // Validate and create support weapons
    if (finalLoadout.support) {
      const totalSlots = this.calculateSupportSlots(finalLoadout.support);
      if (totalSlots <= GAME_CONFIG.LOADOUT.MAX_SUPPORT_SLOTS) {
        for (const supportWeapon of finalLoadout.support) {
          const config = this.getWeaponConfig(supportWeapon);
          if (config) {
            const weapon = this.createWeapon(supportWeapon, config);
            playerWeapons.set(supportWeapon, weapon);
          }
        }
      } else {
        console.warn(`Support loadout exceeds max slots (${totalSlots} > ${GAME_CONFIG.LOADOUT.MAX_SUPPORT_SLOTS})`);
      }
    }
    
    return playerWeapons;
  }
  
  // Calculate total support weapon slots used
  private calculateSupportSlots(supportWeapons: WeaponType[]): number {
    return supportWeapons.reduce((total, weapon) => {
      const cost = GAME_CONFIG.LOADOUT.WEAPON_SLOT_COSTS[weapon as keyof typeof GAME_CONFIG.LOADOUT.WEAPON_SLOT_COSTS] || 0;
      return total + cost;
    }, 0);
  }
  
  createWeapon(type: WeaponType, config: any): WeaponState {
    // Thrown weapons have different ammo logic
    const throwableWeapons = ['grenade', 'smokegrenade', 'flashbang'];
    const isThrowable = throwableWeapons.includes(type);
    
    const weapon: WeaponState = {
      id: `${type}_${Date.now()}`,
      type,
      currentAmmo: config.MAX_AMMO,
      reserveAmmo: isThrowable ? 0 : config.MAX_RESERVE, // Throwables have no reserve
      maxAmmo: config.MAX_AMMO,
      maxReserve: isThrowable ? 0 : config.MAX_RESERVE,
      damage: config.DAMAGE,
      fireRate: config.FIRE_RATE,
      reloadTime: config.RELOAD_TIME,
      isReloading: false,
      lastFireTime: 0,
      accuracy: config.ACCURACY,
      range: config.RANGE
    };
    
    // Add special properties for specific weapons
    if (type === 'shotgun') {
      weapon.pelletCount = config.PELLET_COUNT;
    } else if (type === 'machinegun') {
      weapon.heatLevel = 0;
      weapon.isOverheated = false;
    }
    
    return weapon;
  }
  
  // Handle weapon fire event
  handleWeaponFire(event: WeaponFireEvent, player: PlayerState): { canFire: boolean; weapon?: WeaponState; error?: string } {
    // Debug exactly what's being requested vs what's available
    console.log(`\n🔍 [WEAPON LOOKUP] Searching for weapon...`);
    console.log(`   Requested Type: "${event.weaponType}"`);
    console.log(`   Player Weapon ID: "${player.weaponId}"`);
    console.log(`   Available Weapons:`);
    for (const [type, weapon] of player.weapons) {
      console.log(`     - "${type}" (${weapon.currentAmmo}/${weapon.maxAmmo})`);
    }
    
    const weapon = player.weapons.get(event.weaponType);
    if (!weapon) {
      const error = `Weapon not found: ${event.weaponType}`;
      WeaponDiagnostics.logError('handleWeaponFire', error);
      WeaponDiagnostics.logWeaponState(player);
      return { canFire: false, error };
    }
    
    // Check if weapon is reloading
    if (weapon.isReloading) {
      const error = 'Weapon is reloading';
      WeaponDiagnostics.logWeaponFire(weapon, player, false, error);
      return { canFire: false, error };
    }
    
    // Check ammo
    if (weapon.currentAmmo <= 0) {
      const error = 'No ammo';
      WeaponDiagnostics.logWeaponFire(weapon, player, false, error);
      return { canFire: false, error };
    }
    
    // Check fire rate
    const now = Date.now();
    const fireInterval = (60 / weapon.fireRate) * 1000; // Convert RPM to milliseconds
    if (now - weapon.lastFireTime < fireInterval) {
      const error = 'Fire rate exceeded';
      WeaponDiagnostics.logWeaponFire(weapon, player, false, error);
      return { canFire: false, error };
    }
    
    // Validate event timestamp
    if (Math.abs(now - event.timestamp) > 1000) {
      const error = 'Invalid timestamp';
      WeaponDiagnostics.logWeaponFire(weapon, player, false, error);
      return { canFire: false, error };
    }
    
    // Check machine gun overheat
    if (weapon.type === 'machinegun' && weapon.isOverheated) {
      const error = 'Weapon overheated';
      WeaponDiagnostics.logWeaponFire(weapon, player, false, error);
      return { canFire: false, error };
    }
    
    // Fire the weapon
    weapon.currentAmmo--;
    weapon.lastFireTime = now;
    
    // Handle machine gun heat
    if (weapon.type === 'machinegun') {
      this.updateMachineGunHeat(weapon, true);
    }
    
    WeaponDiagnostics.logWeaponFire(weapon, player, true);
    return { canFire: true, weapon };
  }
  
  // Handle weapon reload
  handleWeaponReload(event: WeaponReloadEvent, player: PlayerState): { canReload: boolean; weapon?: WeaponState; error?: string; playerId?: string } {
    const weapon = player.weapons.get(event.weaponType);
    if (!weapon) {
      const error = 'Weapon not found';
      WeaponDiagnostics.logError('handleWeaponReload', error);
      return { canReload: false, error };
    }
    
    // Thrown weapons can't be reloaded
    const throwableWeapons = ['grenade', 'smokegrenade', 'flashbang'];
    if (throwableWeapons.includes(weapon.type)) {
      const error = 'Thrown weapons cannot be reloaded';
      WeaponDiagnostics.logWeaponReload(weapon, player, false, error);
      return { canReload: false, error };
    }
    
    // Check if already reloading
    if (weapon.isReloading) {
      const error = 'Already reloading';
      WeaponDiagnostics.logWeaponReload(weapon, player, false, error);
      return { canReload: false, error };
    }
    
    // Check if ammo is already full
    if (weapon.currentAmmo >= weapon.maxAmmo) {
      const error = 'Ammo already full';
      WeaponDiagnostics.logWeaponReload(weapon, player, false, error);
      return { canReload: false, error };
    }
    
    // Check if has reserve ammo
    if (weapon.reserveAmmo <= 0) {
      const error = 'No reserve ammo';
      WeaponDiagnostics.logWeaponReload(weapon, player, false, error);
      return { canReload: false, error };
    }
    
    // Start reload
    weapon.isReloading = true;
    
    // Schedule reload completion
    setTimeout(() => {
      this.completeReload(weapon, event.playerId);
    }, weapon.reloadTime);
    
    WeaponDiagnostics.logWeaponReload(weapon, player, true);
    return { canReload: true, weapon, playerId: event.playerId };
  }
  
  private completeReload(weapon: WeaponState, playerId: string): void {
    const ammoNeeded = weapon.maxAmmo - weapon.currentAmmo;
    const ammoToReload = Math.min(ammoNeeded, weapon.reserveAmmo);
    
    weapon.currentAmmo += ammoToReload;
    weapon.reserveAmmo -= ammoToReload;
    weapon.isReloading = false;
    
    // Emit reload complete event through a callback
    if (this.reloadCompleteCallback) {
      this.reloadCompleteCallback(playerId, weapon);
    }
  }
  
  // Callback for reload completion
  private reloadCompleteCallback?: (playerId: string, weapon: WeaponState) => void;
  
  setReloadCompleteCallback(callback: (playerId: string, weapon: WeaponState) => void): void {
    this.reloadCompleteCallback = callback;
  }
  
  // Handle weapon switch
  handleWeaponSwitch(event: WeaponSwitchEvent, player: PlayerState): { canSwitch: boolean; weapon?: WeaponState; error?: string } {
    const weapon = player.weapons.get(event.toWeapon);
    if (!weapon) {
      return { canSwitch: false, error: 'Weapon not found' };
    }
    
    // Check if weapon is currently reloading
    if (weapon.isReloading) {
      return { canSwitch: false, error: 'Weapon is reloading' };
    }
    
    // Update player's current weapon
    player.weaponId = event.toWeapon;
    
    return { canSwitch: true, weapon };
  }
  
  // Handle grenade throw
  handleGrenadeThrow(event: GrenadeThrowEvent, player: PlayerState): { canThrow: boolean; weapon?: WeaponState; error?: string } {
    // Get the currently equipped weapon
    const weapon = player.weapons.get(player.weaponId);
    if (!weapon) {
      return { canThrow: false, error: 'No weapon equipped' };
    }
    
    // Check if it's a throwable weapon
    const throwableWeapons = ['grenade', 'smokegrenade', 'flashbang'];
    if (!throwableWeapons.includes(weapon.type)) {
      return { canThrow: false, error: 'Current weapon is not throwable' };
    }
    
    // Check if has ammo
    if (weapon.currentAmmo <= 0) {
      return { canThrow: false, error: `No ${weapon.type}s available` };
    }
    
    // Validate charge level for regular grenades
    if (weapon.type === 'grenade' && (event.chargeLevel < 1 || event.chargeLevel > GAME_CONFIG.WEAPONS.GRENADE.CHARGE_LEVELS)) {
      return { canThrow: false, error: 'Invalid charge level' };
    }
    
    // Use ammo
    weapon.currentAmmo--;
    weapon.lastFireTime = Date.now();
    
    return { canThrow: true, weapon };
  }
  
  // Calculate weapon accuracy based on player state
  calculateAccuracy(weapon: WeaponState, player: PlayerState): number {
    let accuracy = weapon.accuracy;
    
    // ADS bonus
    if (player.isADS) {
      accuracy += GAME_CONFIG.COMBAT.ADS_ACCURACY_BONUS;
    }
    
    // Movement penalty
    if (player.movementState !== 'idle') {
      accuracy -= GAME_CONFIG.COMBAT.MOVEMENT_ACCURACY_PENALTY;
    }
    
    // Additional penalties for running
    if (player.movementState === 'running') {
      accuracy -= 0.2;
    }
    
    return Math.max(0.1, Math.min(1.0, accuracy));
  }
  
  // Calculate damage with falloff
  calculateDamage(weapon: WeaponState, distance: number): number {
    // Special falloff for shotgun
    if (weapon.type === 'shotgun') {
      const ranges = GAME_CONFIG.COMBAT.SHOTGUN_FALLOFF_RANGES;
      const multipliers = GAME_CONFIG.COMBAT.SHOTGUN_FALLOFF_MULTIPLIERS;
      
      for (let i = 0; i < ranges.length; i++) {
        if (distance <= ranges[i]) {
          return weapon.damage * multipliers[i];
        }
      }
      return weapon.damage * multipliers[multipliers.length - 1];
    }
    
    // Standard falloff for other weapons
    const falloffStart = weapon.range * GAME_CONFIG.COMBAT.DAMAGE_FALLOFF_START;
    
    if (distance <= falloffStart) {
      return weapon.damage;
    }
    
    const falloffRange = weapon.range - falloffStart;
    const falloffFactor = Math.max(0, (weapon.range - distance) / falloffRange);
    const minDamage = weapon.damage * GAME_CONFIG.COMBAT.DAMAGE_FALLOFF_MIN;
    
    return Math.max(minDamage, weapon.damage * falloffFactor);
  }
  
  // Calculate explosion damage
  calculateExplosionDamage(baseDamage: number, distance: number, radius: number): number {
    if (distance >= radius) {
      return 0;
    }
    
    const falloffFactor = Math.pow(1 - (distance / radius), GAME_CONFIG.COMBAT.EXPLOSION_FALLOFF_POWER);
    return baseDamage * falloffFactor;
  }
  
  // Perform hitscan for bullets
  performHitscan(startPos: Vector2, direction: number, range: number, weapon: WeaponState, player: PlayerState, walls: Map<string, any>, players: Map<string, PlayerState>): HitscanResult {
    const accuracy = this.calculateAccuracy(weapon, player);
    
    // Apply spread based on accuracy
    const maxSpread = (1 - accuracy) * 0.2; // 0.2 radians max spread
    const spread = (Math.random() - 0.5) * maxSpread;
    const finalDirection = direction + spread;
    
    // Calculate end position
    const endPos = {
      x: startPos.x + Math.cos(finalDirection) * range,
      y: startPos.y + Math.sin(finalDirection) * range
    };
    
    // Check for hits along the ray
    const result = this.raycast(startPos, endPos, walls, players, player.id);
    
    return result;
  }
  
  // Perform hitscan with penetration support
  performHitscanWithPenetration(
    startPos: Vector2, 
    direction: number, 
    range: number, 
    weapon: WeaponState, 
    player: PlayerState, 
    walls: Map<string, any>, 
    players: Map<string, PlayerState>
  ): PenetrationHit[] {
    const accuracy = this.calculateAccuracy(weapon, player);
    
    // Apply spread based on accuracy
    const maxSpread = (1 - accuracy) * 0.2; // 0.2 radians max spread
    const spread = (Math.random() - 0.5) * maxSpread;
    const finalDirection = direction + spread;
    
    // Calculate end position
    const endPos = {
      x: startPos.x + Math.cos(finalDirection) * range,
      y: startPos.y + Math.sin(finalDirection) * range
    };
    
    // Use special penetration logic for anti-material rifle
    if (weapon.type === 'antimaterialrifle') {
      return this.raycastAntiMaterialPenetration(startPos, endPos, walls, players, player.id, weapon.damage);
    }
    
    // Check for hits along the ray with standard penetration
    const hits = this.raycastWithPenetration(startPos, endPos, walls, players, player.id, weapon.damage);
    
    return hits;
  }
  
  // Raycast for collision detection
  private raycast(start: Vector2, end: Vector2, walls: Map<string, any>, players: Map<string, PlayerState>, shooterId: string): HitscanResult {
    const direction = {
      x: end.x - start.x,
      y: end.y - start.y
    };
    const distance = Math.sqrt(direction.x * direction.x + direction.y * direction.y);
    
    // Normalize direction
    direction.x /= distance;
    direction.y /= distance;
    
    let closestHit: HitscanResult = {
      hit: false,
      hitPoint: end,
      distance: distance,
      targetType: 'none'
    };
    
    // Collect all wall hits along the ray path
    const wallHits: Array<{
      wallId: string;
      wall: any;
      hitPoint: Vector2;
      distance: number;
      sliceIndex: number;
    }> = [];
    
    // First, find all walls the ray intersects
    for (const [wallId, wall] of walls) {
      const wallHit = this.checkWallHit(start, direction, distance, wall);
      if (wallHit) {
        wallHits.push({
          wallId,
          wall,
          hitPoint: wallHit.hitPoint,
          distance: wallHit.distance,
          sliceIndex: wallHit.sliceIndex
        });
      }
    }
    
    // Sort wall hits by distance
    wallHits.sort((a, b) => a.distance - b.distance);
    
    // Process wall hits in order
    for (const hit of wallHits) {
      // Check if this hit is closer than our current closest hit
      if (hit.distance >= closestHit.distance) continue;
      
      // Check if the slice is destroyed
      if (hit.wall.destructionMask && hit.wall.destructionMask[hit.sliceIndex] === 1) {
        // This slice is destroyed - check for intact slices within this wall
        const sliceDimension = getSliceDimension(hit.wall);
        let foundIntactSlice = false;
        
        // Step through the wall to find intact slices
        const rayStep = 0.5;
        const stepDimension = hit.wall.orientation === 'horizontal' ? hit.wall.width : hit.wall.height;
        const maxSteps = Math.min(100, stepDimension / rayStep);
        
        for (let step = 1; step <= maxSteps; step++) {
          const checkDist = hit.distance + (step * rayStep);
          if (checkDist >= distance || checkDist >= closestHit.distance) break;
          
          const checkPoint = {
            x: start.x + direction.x * checkDist,
            y: start.y + direction.y * checkDist
          };
          
          // Check if we're still inside the wall
          if (checkPoint.y >= hit.wall.position.y && 
              checkPoint.y <= hit.wall.position.y + hit.wall.height &&
              checkPoint.x >= hit.wall.position.x && 
              checkPoint.x <= hit.wall.position.x + hit.wall.width) {
            
            // Calculate which slice we're in
            const currentSliceIndex = calculateSliceIndex(hit.wall, checkPoint);
            
            // If we hit an intact slice, record it
            if (hit.wall.destructionMask[currentSliceIndex] === 0) {
              closestHit = {
                hit: true,
                targetType: 'wall',
                targetId: hit.wallId,
                hitPoint: checkPoint,
                distance: checkDist,
                wallSliceIndex: currentSliceIndex
              };
              foundIntactSlice = true;
              break;
            }
          } else {
            // We've exited the wall without hitting an intact slice
            break;
          }
        }
        
        // If we found an intact slice in this wall, stop processing
        if (foundIntactSlice) break;
        
        // Otherwise, continue to check walls behind this one
      } else {
        // Hit an intact slice - this is our final hit
        closestHit = {
          hit: true,
          targetType: 'wall',
          targetId: hit.wallId,
          hitPoint: hit.hitPoint,
          distance: hit.distance,
          wallSliceIndex: hit.sliceIndex
        };
        break; // Stop checking further walls
      }
    }
    
    // Check player collisions
    for (const [playerId, player] of players) {
      if (playerId === shooterId || !player.isAlive) continue;
      
      const playerHit = this.checkPlayerHit(start, direction, distance, player);
      if (playerHit && playerHit.distance < closestHit.distance) {
        closestHit = {
          hit: true,
          hitPoint: playerHit.hitPoint,
          distance: playerHit.distance,
          targetType: 'player',
          targetId: playerId
        };
      }
    }
    
    return closestHit;
  }
  
  // Raycast with penetration support for soft walls
  private raycastWithPenetration(
    start: Vector2, 
    end: Vector2, 
    walls: Map<string, any>, 
    players: Map<string, PlayerState>, 
    shooterId: string,
    initialDamage: number
  ): PenetrationHit[] {
    const direction = {
      x: end.x - start.x,
      y: end.y - start.y
    };
    const distance = Math.sqrt(direction.x * direction.x + direction.y * direction.y);
    
    // Normalize direction
    direction.x /= distance;
    direction.y /= distance;
    
    const hits: PenetrationHit[] = [];
    let currentDamage = initialDamage;
    let currentStart = { ...start };
    let remainingDistance = distance;
    let iterations = 0;
    const maxIterations = 20; // Safety limit to prevent infinite loops
    
    // Keep searching until we run out of damage or distance
    while (currentDamage > 0 && remainingDistance > 0 && iterations < maxIterations) {
      iterations++;
      let closestHit: {
        type: 'player' | 'wall';
        id: string;
        hitPoint: Vector2;
        distance: number;
        sliceIndex?: number;
        wall?: any;
      } | null = null;
      
      // Check all walls
      for (const [wallId, wall] of walls) {
        const wallHit = this.checkWallHit(currentStart, direction, remainingDistance, wall);
        if (wallHit) {
          if (!closestHit || wallHit.distance < closestHit.distance) {
            closestHit = {
              type: 'wall',
              id: wallId,
              hitPoint: wallHit.hitPoint,
              distance: wallHit.distance,
              sliceIndex: wallHit.sliceIndex,
              wall: wall
            };
          }
        }
      }
      
      // Check all players
      for (const [playerId, player] of players) {
        if (playerId === shooterId || !player.isAlive) {
          continue;
        }
        
        const playerHit = this.checkPlayerHit(currentStart, direction, remainingDistance, player);
        if (playerHit) {
          if (!closestHit || playerHit.distance < closestHit.distance) {
            closestHit = {
              type: 'player',
              id: playerId,
              hitPoint: playerHit.hitPoint,
              distance: playerHit.distance
            };
          }
        }
      }
      
      // If no hit, we're done
      if (!closestHit) break;
      
      // Process the hit
      if (closestHit.type === 'player') {
        // Player hit - bullet stops here
        hits.push({
          targetType: 'player',
          targetId: closestHit.id,
          hitPoint: closestHit.hitPoint,
          distance: closestHit.distance,
          damage: currentDamage,
          remainingDamage: 0
        });
        break; // Bullet stops at player
      } else {
        // Wall hit
        const wall = closestHit.wall!;
        const sliceIndex = closestHit.sliceIndex!;
        
        // Check if slice is already destroyed
        if (wall.destructionMask && wall.destructionMask[sliceIndex] === 1) {
          // Slice is destroyed - ray continues without damage reduction
          // Move start point slightly past the hit to avoid re-hitting the same wall
          const epsilon = 0.1;
          currentStart = {
            x: closestHit.hitPoint.x + direction.x * epsilon,
            y: closestHit.hitPoint.y + direction.y * epsilon
          };
          remainingDistance -= (closestHit.distance + epsilon);
          continue;
        }
        
        // Check if it's a hard wall
        if (isHardWall(wall.material)) {
          // console.log(`🛑 Bullet hit hard wall ${wall.material}, stopping`);
          // Hard wall - bullet stops here
          hits.push({
            targetType: 'wall',
            targetId: closestHit.id,
            hitPoint: closestHit.hitPoint,
            distance: closestHit.distance,
            wallSliceIndex: sliceIndex,
            damage: currentDamage,
            remainingDamage: 0
          });
          break;
        } else {
          // Soft wall - apply penetration
          const penetrationDamage = GAME_CONFIG.DESTRUCTION.SOFT_WALL_PENETRATION_DAMAGE;
          const sliceHealth = wall.sliceHealth[sliceIndex];
          
          // Calculate actual penetration cost (limited by wall's remaining health)
          const actualPenetrationCost = Math.min(penetrationDamage, sliceHealth);
          
          if (currentDamage >= actualPenetrationCost) {
            // Bullet penetrates
            const damageToWall = actualPenetrationCost;
            const remainingDamage = currentDamage - damageToWall;
            // console.log(`🔫 Bullet penetrates soft wall ${wall.material}, wall health: ${sliceHealth}, penetration cost: ${actualPenetrationCost}, bullet: ${currentDamage} -> ${remainingDamage}`);
            
            hits.push({
              targetType: 'wall',
              targetId: closestHit.id,
              hitPoint: closestHit.hitPoint,
              distance: closestHit.distance,
              wallSliceIndex: sliceIndex,
              damage: damageToWall,
              remainingDamage: remainingDamage
            });
            
            // Continue with reduced damage
            currentDamage = remainingDamage;
            // Move start point slightly past the hit to avoid re-hitting the same wall
            const epsilon = 0.1;
            currentStart = {
              x: closestHit.hitPoint.x + direction.x * epsilon,
              y: closestHit.hitPoint.y + direction.y * epsilon
            };
            remainingDistance -= (closestHit.distance + epsilon);
          } else {
            // Bullet doesn't have enough damage to penetrate
            hits.push({
              targetType: 'wall',
              targetId: closestHit.id,
              hitPoint: closestHit.hitPoint,
              distance: closestHit.distance,
              wallSliceIndex: sliceIndex,
              damage: currentDamage,
              remainingDamage: 0
            });
            break;
          }
        }
      }
    }
    
    return hits;
  }
  
  // Check if ray hits a player
  private checkPlayerHit(start: Vector2, direction: Vector2, maxDistance: number, player: PlayerState): { hitPoint: Vector2; distance: number } | null {
    const playerPos = player.transform.position;
    const playerRadius = GAME_CONFIG.PLAYER_SIZE / 2;
    
    // Vector from start to player center
    const toPlayer = {
      x: playerPos.x - start.x,
      y: playerPos.y - start.y
    };
    
    // Project onto ray direction
    const projectionLength = toPlayer.x * direction.x + toPlayer.y * direction.y;
    
    // Check if projection is within ray bounds
    if (projectionLength < 0 || projectionLength > maxDistance) {
      return null;
    }
    
    // Find closest point on ray to player center
    const closestPoint = {
      x: start.x + direction.x * projectionLength,
      y: start.y + direction.y * projectionLength
    };
    
    // Check distance to player center
    const distanceToCenter = Math.sqrt(
      Math.pow(closestPoint.x - playerPos.x, 2) + 
      Math.pow(closestPoint.y - playerPos.y, 2)
    );
    
    if (distanceToCenter <= playerRadius) {
      return {
        hitPoint: closestPoint,
        distance: projectionLength
      };
    }
    
    return null;
  }
  
  // Check if ray hits a wall
  private checkWallHit(start: Vector2, direction: Vector2, maxDistance: number, wall: any): { hitPoint: Vector2; distance: number; sliceIndex: number } | null {
    // For walls with pre-destroyed slices, we need to check each intact slice individually
    // to avoid hitting the "invisible" parts of the wall
    
    // First, determine which slices are intact
    const intactSlices: number[] = [];
    for (let i = 0; i < 5; i++) {
      if (!wall.destructionMask || wall.destructionMask[i] === 0) {
        intactSlices.push(i);
      }
    }
    
    // If no intact slices, wall is fully destroyed
    if (intactSlices.length === 0) {
      return null;
    }
    
    // Check collision with each intact slice's bounding box
    let closestHit: { hitPoint: Vector2; distance: number; sliceIndex: number } | null = null;
    
    for (const sliceIndex of intactSlices) {
      // Calculate the bounds of this specific slice
      const sliceBounds = this.getSliceBounds(wall, sliceIndex);
      
      // Ray-AABB intersection for this slice
      let tMinX = -Infinity;
      let tMaxX = Infinity;
      let tMinY = -Infinity;
      let tMaxY = Infinity;
      
      // X-axis intersection
      if (Math.abs(direction.x) > 0.0001) {
        const t1 = (sliceBounds.left - start.x) / direction.x;
        const t2 = (sliceBounds.right - start.x) / direction.x;
        tMinX = Math.min(t1, t2);
        tMaxX = Math.max(t1, t2);
      } else {
        // Ray is parallel to X-axis
        if (start.x < sliceBounds.left || start.x > sliceBounds.right) {
          continue; // Ray misses this slice
        }
      }
      
      // Y-axis intersection
      if (Math.abs(direction.y) > 0.0001) {
        const t1 = (sliceBounds.top - start.y) / direction.y;
        const t2 = (sliceBounds.bottom - start.y) / direction.y;
        tMinY = Math.min(t1, t2);
        tMaxY = Math.max(t1, t2);
      } else {
        // Ray is parallel to Y-axis
        if (start.y < sliceBounds.top || start.y > sliceBounds.bottom) {
          continue; // Ray misses this slice
        }
      }
      
      // Find intersection
      const tMin = Math.max(tMinX, tMinY);
      const tMax = Math.min(tMaxX, tMaxY);
      
      if (tMin <= tMax && tMin >= 0 && tMin <= maxDistance) {
        const hitPoint = {
          x: start.x + direction.x * tMin,
          y: start.y + direction.y * tMin
        };
        
        // Check if this is the closest hit so far
        if (!closestHit || tMin < closestHit.distance) {
          closestHit = {
            hitPoint,
            distance: tMin,
            sliceIndex: sliceIndex
          };
        }
      }
    }
    
    return closestHit;
  }
  
  // Helper method to get the bounds of a specific wall slice
  private getSliceBounds(wall: any, sliceIndex: number): { left: number; right: number; top: number; bottom: number } {
    const sliceWidth = wall.width / 5;
    const sliceHeight = wall.height / 5;
    
    if (wall.orientation === 'horizontal') {
      // Horizontal wall - slices are arranged left to right
      return {
        left: wall.position.x + (sliceIndex * sliceWidth),
        right: wall.position.x + ((sliceIndex + 1) * sliceWidth),
        top: wall.position.y,
        bottom: wall.position.y + wall.height
      };
    } else {
      // Vertical wall - slices are arranged top to bottom
      return {
        left: wall.position.x,
        right: wall.position.x + wall.width,
        top: wall.position.y + (sliceIndex * sliceHeight),
        bottom: wall.position.y + ((sliceIndex + 1) * sliceHeight)
      };
    }
  }
  
  // Generate unique projectile ID
  generateProjectileId(): string {
    return `projectile_${++this.projectileId}`;
  }
  
  // Update machine gun heat level
  private updateMachineGunHeat(weapon: WeaponState, isFiring: boolean): void {
    if (!weapon.heatLevel) weapon.heatLevel = 0;
    
    const config = GAME_CONFIG.WEAPONS.MACHINEGUN;
    
    if (isFiring) {
      // Increase heat when firing
      weapon.heatLevel = Math.min(100, weapon.heatLevel + config.HEAT_GAIN_PER_SHOT);
      
      // Check for overheat
      if (weapon.heatLevel >= config.OVERHEAT_THRESHOLD) {
        weapon.isOverheated = true;
        
        // Schedule cooldown
        setTimeout(() => {
          weapon.isOverheated = false;
          weapon.heatLevel = 50; // Reset to 50% after overheat
          
          // Emit heat update
          if (this.heatUpdateCallback) {
            this.heatUpdateCallback({
              weaponType: 'machinegun',
              heatLevel: weapon.heatLevel,
              isOverheated: false
            });
          }
        }, config.OVERHEAT_PENALTY_TIME);
      }
    }
    
    // Emit heat update
    if (this.heatUpdateCallback) {
      this.heatUpdateCallback({
        weaponType: 'machinegun',
        heatLevel: weapon.heatLevel,
        isOverheated: !!weapon.isOverheated
      });
    }
  }
  
  // Cool down machine gun over time
  cooldownMachineGuns(weapons: Map<string, WeaponState>, deltaTime: number): void {
    for (const [weaponId, weapon] of weapons) {
      if (weapon.type === 'machinegun' && weapon.heatLevel && weapon.heatLevel > 0 && !weapon.isOverheated) {
        const config = GAME_CONFIG.WEAPONS.MACHINEGUN;
        const cooldownAmount = config.HEAT_COOLDOWN_RATE * (deltaTime / 1000);
        weapon.heatLevel = Math.max(0, weapon.heatLevel - cooldownAmount);
        
        // Emit periodic heat updates
        if (this.heatUpdateCallback && Math.floor(weapon.heatLevel) % 10 === 0) {
          this.heatUpdateCallback({
            weaponType: 'machinegun',
            heatLevel: weapon.heatLevel,
            isOverheated: false
          });
        }
      }
    }
  }
  
  // Generate shotgun pellet spread
  generateShotgunPellets(baseDirection: number, pelletCount: number = 8): number[] {
    const config = GAME_CONFIG.WEAPONS.SHOTGUN;
    const spreadAngle = config.SPREAD_ANGLE;
    const directions: number[] = [];
    
    for (let i = 0; i < pelletCount; i++) {
      // Random spread within the cone
      const spread = (Math.random() - 0.5) * spreadAngle;
      directions.push(baseDirection + spread);
    }
    
    return directions;
  }
  
  // Callback for heat updates
  private heatUpdateCallback?: (event: WeaponHeatUpdateEvent) => void;
  
  setHeatUpdateCallback(callback: (event: WeaponHeatUpdateEvent) => void): void {
    this.heatUpdateCallback = callback;
  }
  
  // Raycast for anti-material rifle with multi-target penetration
  private raycastAntiMaterialPenetration(
    start: Vector2, 
    end: Vector2, 
    walls: Map<string, any>, 
    players: Map<string, PlayerState>, 
    shooterId: string,
    initialDamage: number
  ): PenetrationHit[] {
    const direction = {
      x: end.x - start.x,
      y: end.y - start.y
    };
    const distance = Math.sqrt(direction.x * direction.x + direction.y * direction.y);
    
    // Normalize direction
    direction.x /= distance;
    direction.y /= distance;
    
    const config = GAME_CONFIG.WEAPONS.ANTIMATERIALRIFLE;
    const hits: PenetrationHit[] = [];
    let currentDamage = initialDamage;
    let currentStart = { ...start };
    let remainingDistance = distance;
    let penetrationCount = 0;
    let wallPenetrations = 0;
    let playerPenetrations = 0;
    
    // Keep searching until we run out of penetrations or distance
    while (penetrationCount < config.MAX_PENETRATIONS && remainingDistance > 0 && currentDamage > 0) {
      let closestHit: {
        type: 'player' | 'wall';
        id: string;
        hitPoint: Vector2;
        distance: number;
        sliceIndex?: number;
        wall?: any;
      } | null = null;
      
      // Check all walls
      for (const [wallId, wall] of walls) {
        const wallHit = this.checkWallHit(currentStart, direction, remainingDistance, wall);
        if (wallHit) {
          if (!closestHit || wallHit.distance < closestHit.distance) {
            closestHit = {
              type: 'wall',
              id: wallId,
              hitPoint: wallHit.hitPoint,
              distance: wallHit.distance,
              sliceIndex: wallHit.sliceIndex,
              wall: wall
            };
          }
        }
      }
      
      // Check all players
      for (const [playerId, player] of players) {
        if (playerId === shooterId || !player.isAlive) continue;
        
        const playerHit = this.checkPlayerHit(currentStart, direction, remainingDistance, player);
        if (playerHit) {
          if (!closestHit || playerHit.distance < closestHit.distance) {
            closestHit = {
              type: 'player',
              id: playerId,
              hitPoint: playerHit.hitPoint,
              distance: playerHit.distance
            };
          }
        }
      }
      
      // If no hit, we're done
      if (!closestHit) break;
      
      // Process the hit
      if (closestHit.type === 'player') {
        // Player hit - can penetrate up to 2 players
        if (playerPenetrations >= 2) {
          // Can't penetrate more players
          hits.push({
            targetType: 'player',
            targetId: closestHit.id,
            hitPoint: closestHit.hitPoint,
            distance: closestHit.distance,
            damage: currentDamage,
            remainingDamage: 0
          });
          break;
        }
        
        // Apply damage reduction for player penetration
        const damageReduction = config.PENETRATION_DAMAGE_LOSS[Math.min(penetrationCount, 2)];
        const damageDealt = currentDamage * (1 - damageReduction);
        currentDamage *= damageReduction;
        
        hits.push({
          targetType: 'player',
          targetId: closestHit.id,
          hitPoint: closestHit.hitPoint,
          distance: closestHit.distance,
          damage: damageDealt,
          remainingDamage: currentDamage
        });
        
        playerPenetrations++;
        penetrationCount++;
      } else {
        // Wall hit
        const wall = closestHit.wall!;
        const sliceIndex = closestHit.sliceIndex!;
        
        // Check if slice is already destroyed
        if (wall.destructionMask && wall.destructionMask[sliceIndex] === 1) {
          // Slice is destroyed - ray continues without damage reduction
          const epsilon = 0.1;
          currentStart = {
            x: closestHit.hitPoint.x + direction.x * epsilon,
            y: closestHit.hitPoint.y + direction.y * epsilon
          };
          remainingDistance -= (closestHit.distance + epsilon);
          continue;
        }
        
        // Can't penetrate more than 3 walls
        if (wallPenetrations >= 3) {
          hits.push({
            targetType: 'wall',
            targetId: closestHit.id,
            hitPoint: closestHit.hitPoint,
            distance: closestHit.distance,
            wallSliceIndex: sliceIndex,
            damage: currentDamage,
            remainingDamage: 0
          });
          break;
        }
        
        // Apply damage reduction for wall penetration
        const damageReduction = config.PENETRATION_DAMAGE_LOSS[Math.min(penetrationCount, 2)];
        const damageToWall = currentDamage * (1 - damageReduction);
        currentDamage *= (1 - damageReduction);
        
        hits.push({
          targetType: 'wall',
          targetId: closestHit.id,
          hitPoint: closestHit.hitPoint,
          distance: closestHit.distance,
          wallSliceIndex: sliceIndex,
          damage: damageToWall,
          remainingDamage: currentDamage
        });
        
        wallPenetrations++;
        penetrationCount++;
      }
      
      // Move start point slightly past the hit
      const epsilon = 0.1;
      currentStart = {
        x: closestHit.hitPoint.x + direction.x * epsilon,
        y: closestHit.hitPoint.y + direction.y * epsilon
      };
      remainingDistance -= (closestHit.distance + epsilon);
    }
    
    return hits;
  }
  
  // Get weapon configuration
  getWeaponConfig(weaponType: WeaponType) {
    const weaponMap: Record<WeaponType, any> = {
      // Primary
      rifle: GAME_CONFIG.WEAPONS.RIFLE,
      smg: GAME_CONFIG.WEAPONS.SMG,
      shotgun: GAME_CONFIG.WEAPONS.SHOTGUN,
      battlerifle: GAME_CONFIG.WEAPONS.BATTLERIFLE,
      sniperrifle: GAME_CONFIG.WEAPONS.SNIPERRIFLE,
      // Secondary
      pistol: GAME_CONFIG.WEAPONS.PISTOL,
      revolver: GAME_CONFIG.WEAPONS.REVOLVER,
      suppressedpistol: GAME_CONFIG.WEAPONS.SUPPRESSEDPISTOL,
      // Support
      grenadelauncher: GAME_CONFIG.WEAPONS.GRENADELAUNCHER,
      machinegun: GAME_CONFIG.WEAPONS.MACHINEGUN,
      antimaterialrifle: GAME_CONFIG.WEAPONS.ANTIMATERIALRIFLE,
      // Thrown
      grenade: GAME_CONFIG.WEAPONS.GRENADE,
      smokegrenade: GAME_CONFIG.WEAPONS.SMOKEGRENADE,
      flashbang: GAME_CONFIG.WEAPONS.FLASHBANG,
      rocket: GAME_CONFIG.WEAPONS.ROCKET
    };
    
    return weaponMap[weaponType] || GAME_CONFIG.WEAPONS.RIFLE;
  }
} 