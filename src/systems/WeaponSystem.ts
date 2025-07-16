import { WeaponState, WeaponFireEvent, WeaponHitEvent, WeaponReloadEvent, WeaponSwitchEvent, GrenadeThrowEvent, PlayerState, Vector2, HitscanResult } from '../../shared/types';
import { GAME_CONFIG } from '../../shared/constants';

export class WeaponSystem {
  private weapons: Map<string, WeaponState> = new Map();
  private projectileId: number = 0;
  
  constructor() {
    // console.log('WeaponSystem initialized');
  }
  
  // Initialize player weapons
  initializePlayerWeapons(playerId: string): Map<string, WeaponState> {
    const playerWeapons = new Map<string, WeaponState>();
    
    // Create rifle (default weapon)
    const rifle = this.createWeapon('rifle', GAME_CONFIG.WEAPONS.RIFLE);
    playerWeapons.set('rifle', rifle);
    
    // Create pistol (secondary weapon)
    const pistol = this.createWeapon('pistol', GAME_CONFIG.WEAPONS.PISTOL);
    playerWeapons.set('pistol', pistol);
    
    // Create grenade (limited ammo)
    const grenade = this.createWeapon('grenade', GAME_CONFIG.WEAPONS.GRENADE);
    playerWeapons.set('grenade', grenade);
    
    // Create rocket (limited ammo)
    const rocket = this.createWeapon('rocket', GAME_CONFIG.WEAPONS.ROCKET);
    playerWeapons.set('rocket', rocket);
    
    return playerWeapons;
  }
  
  private createWeapon(type: 'rifle' | 'pistol' | 'grenade' | 'rocket', config: any): WeaponState {
    return {
      id: `${type}_${Date.now()}`,
      type,
      currentAmmo: config.MAX_AMMO,
      reserveAmmo: config.MAX_RESERVE,
      maxAmmo: config.MAX_AMMO,
      maxReserve: config.MAX_RESERVE,
      damage: config.DAMAGE,
      fireRate: config.FIRE_RATE,
      reloadTime: config.RELOAD_TIME,
      isReloading: false,
      lastFireTime: 0,
      accuracy: config.ACCURACY,
      range: config.RANGE
    };
  }
  
  // Handle weapon fire event
  handleWeaponFire(event: WeaponFireEvent, player: PlayerState): { canFire: boolean; weapon?: WeaponState; error?: string } {
    const weapon = player.weapons.get(event.weaponType);
    if (!weapon) {
      return { canFire: false, error: 'Weapon not found' };
    }
    
    // Check if weapon is reloading
    if (weapon.isReloading) {
      return { canFire: false, error: 'Weapon is reloading' };
    }
    
    // Check ammo
    if (weapon.currentAmmo <= 0) {
      return { canFire: false, error: 'No ammo' };
    }
    
    // Check fire rate
    const now = Date.now();
    const fireInterval = (60 / weapon.fireRate) * 1000; // Convert RPM to milliseconds
    if (now - weapon.lastFireTime < fireInterval) {
      return { canFire: false, error: 'Fire rate exceeded' };
    }
    
    // Validate event timestamp
    if (Math.abs(now - event.timestamp) > 1000) {
      return { canFire: false, error: 'Invalid timestamp' };
    }
    
    // Fire the weapon
    weapon.currentAmmo--;
    weapon.lastFireTime = now;
    
    return { canFire: true, weapon };
  }
  
  // Handle weapon reload
  handleWeaponReload(event: WeaponReloadEvent, player: PlayerState): { canReload: boolean; weapon?: WeaponState; error?: string; playerId?: string } {
    const weapon = player.weapons.get(event.weaponType);
    if (!weapon) {
      return { canReload: false, error: 'Weapon not found' };
    }
    
    // Check if already reloading
    if (weapon.isReloading) {
      return { canReload: false, error: 'Already reloading' };
    }
    
    // Check if ammo is already full
    if (weapon.currentAmmo >= weapon.maxAmmo) {
      return { canReload: false, error: 'Ammo already full' };
    }
    
    // Check if has reserve ammo
    if (weapon.reserveAmmo <= 0) {
      return { canReload: false, error: 'No reserve ammo' };
    }
    
    // Start reload
    weapon.isReloading = true;
    
    // Schedule reload completion
    setTimeout(() => {
      this.completeReload(weapon, event.playerId);
    }, weapon.reloadTime);
    
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
    const weapon = player.weapons.get('grenade');
    if (!weapon) {
      return { canThrow: false, error: 'Grenade not found' };
    }
    
    // Check if has grenades
    if (weapon.currentAmmo <= 0) {
      return { canThrow: false, error: 'No grenades' };
    }
    
    // Validate charge level
    if (event.chargeLevel < 1 || event.chargeLevel > GAME_CONFIG.WEAPONS.GRENADE.CHARGE_LEVELS) {
      return { canThrow: false, error: 'Invalid charge level' };
    }
    
    // Use grenade
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
        const sliceWidth = hit.wall.width / GAME_CONFIG.DESTRUCTION.WALL_SLICES;
        let foundIntactSlice = false;
        
        // Step through the wall to find intact slices
        const rayStep = 0.5;
        const maxSteps = Math.min(100, hit.wall.width / rayStep);
        
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
            const currentSliceIndex = Math.floor((checkPoint.x - hit.wall.position.x) / sliceWidth);
            const clampedIndex = Math.max(0, Math.min(GAME_CONFIG.DESTRUCTION.WALL_SLICES - 1, currentSliceIndex));
            
            // If we hit an intact slice, record it
            if (hit.wall.destructionMask[clampedIndex] === 0) {
              closestHit = {
                hit: true,
                targetType: 'wall',
                targetId: hit.wallId,
                hitPoint: checkPoint,
                distance: checkDist,
                wallSliceIndex: clampedIndex
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
    // Simple AABB collision for now
    const wallBounds = {
      left: wall.position.x,
      right: wall.position.x + wall.width,
      top: wall.position.y,
      bottom: wall.position.y + wall.height
    };
    
    // Handle division by zero for ray-AABB intersection
    let tMinX = -Infinity;
    let tMaxX = Infinity;
    let tMinY = -Infinity;
    let tMaxY = Infinity;
    
    // X-axis intersection
    if (Math.abs(direction.x) > 0.0001) {
      const t1 = (wallBounds.left - start.x) / direction.x;
      const t2 = (wallBounds.right - start.x) / direction.x;
      tMinX = Math.min(t1, t2);
      tMaxX = Math.max(t1, t2);
    } else {
      // Ray is parallel to X-axis
      if (start.x < wallBounds.left || start.x > wallBounds.right) {
        return null; // Ray misses the wall
      }
    }
    
    // Y-axis intersection
    if (Math.abs(direction.y) > 0.0001) {
      const t1 = (wallBounds.top - start.y) / direction.y;
      const t2 = (wallBounds.bottom - start.y) / direction.y;
      tMinY = Math.min(t1, t2);
      tMaxY = Math.max(t1, t2);
    } else {
      // Ray is parallel to Y-axis
      if (start.y < wallBounds.top || start.y > wallBounds.bottom) {
        return null; // Ray misses the wall
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
      
      // Calculate which slice was hit
      const sliceWidth = wall.width / GAME_CONFIG.DESTRUCTION.WALL_SLICES;
      const sliceIndex = Math.floor((hitPoint.x - wall.position.x) / sliceWidth);
      const clampedSliceIndex = Math.max(0, Math.min(GAME_CONFIG.DESTRUCTION.WALL_SLICES - 1, sliceIndex));
      
      // Always return the hit info, even for destroyed slices
      // The performHitscan method will handle checking for intact slices
      return {
        hitPoint,
        distance: tMin,
        sliceIndex: clampedSliceIndex
      };
    }
    
    return null;
  }
  
  // Generate unique projectile ID
  generateProjectileId(): string {
    return `projectile_${++this.projectileId}`;
  }
  
  // Get weapon configuration
  getWeaponConfig(weaponType: 'rifle' | 'pistol' | 'grenade' | 'rocket') {
    switch (weaponType) {
      case 'rifle':
        return GAME_CONFIG.WEAPONS.RIFLE;
      case 'pistol':
        return GAME_CONFIG.WEAPONS.PISTOL;
      case 'grenade':
        return GAME_CONFIG.WEAPONS.GRENADE;
      case 'rocket':
        return GAME_CONFIG.WEAPONS.ROCKET;
      default:
        return GAME_CONFIG.WEAPONS.RIFLE;
    }
  }
} 