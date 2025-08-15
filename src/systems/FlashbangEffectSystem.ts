import { Vector2, PlayerState, FlashbangEffectEvent, PlayerEffectState } from '../../shared/types';
import { GAME_CONFIG } from '../../shared/constants';

interface Wall {
  position: Vector2;
  width: number;
  height: number;
  destructionMask?: Uint8Array | number[];
}

export class FlashbangEffectSystem {
  constructor() {
    console.log('FlashbangEffectSystem initialized');
  }
  
  /**
   * Calculate flashbang effects on all players
   */
  calculateFlashbangEffects(
    flashPosition: Vector2,
    players: Map<string, PlayerState>,
    walls: Map<string, any>
  ): FlashbangEffectEvent {
    const config = GAME_CONFIG.WEAPONS.FLASHBANG;
    const affectedPlayers: FlashbangEffectEvent['affectedPlayers'] = [];
    const flashId = `flash_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    for (const [playerId, player] of players) {
      if (!player.isAlive) continue;
      
      const distance = this.calculateDistance(flashPosition, player.transform.position);
      
      // Skip if player is outside maximum effect radius
      if (distance > config.EFFECT_RADIUS) continue;
      
      // Calculate line of sight
      const lineOfSight = this.hasLineOfSight(flashPosition, player.transform.position, walls);
      
      // Calculate viewing angle (how directly the player was looking at the flash)
      const viewingAngle = this.calculateViewingAngle(
        player.transform.position,
        player.transform.rotation,
        flashPosition
      );
      
      // Calculate base intensity based on distance
      const distanceRatio = distance / config.EFFECT_RADIUS;
      let baseIntensity = 1 - Math.pow(distanceRatio, config.DISTANCE_FALLOFF);
      
      // Apply line of sight modifiers - NO EFFECT if wall is blocking
      if (!lineOfSight) {
        baseIntensity *= config.WALL_PENETRATION_FACTOR;
      }
      
      // Apply viewing angle modifier - GREATLY REDUCED if looking away
      const angleMultiplier = 1 - (viewingAngle * config.ANGLE_EFFECT_MULTIPLIER);
      baseIntensity *= angleMultiplier;
      
      // If looking completely away (> 90 degrees), no effect at all
      if (viewingAngle > 0.5) {
        baseIntensity *= (1 - viewingAngle) * 0.5; // Extra reduction for looking away
      }
      
      // Skip if intensity is too low to matter (raised threshold)
      if (baseIntensity < 0.15) continue;
      
      // Calculate effect durations based on intensity
      const phases = this.calculateEffectPhases(baseIntensity);
      const totalDuration = phases.blindDuration + phases.disorientedDuration + phases.recoveringDuration;
      
      affectedPlayers.push({
        playerId,
        distance,
        lineOfSight,
        viewingAngle,
        intensity: baseIntensity,
        duration: totalDuration,
        phases
      });
      
      console.log(`⚡ Flashbang affects ${playerId.substring(0, 8)}: intensity=${baseIntensity.toFixed(2)}, duration=${totalDuration}ms`);
    }
    
    return {
      id: flashId,
      position: flashPosition,
      affectedPlayers,
      timestamp: Date.now()
    };
  }
  
  /**
   * Apply flashbang effects to a player's effect state
   */
  applyFlashbangEffect(player: PlayerState, effectData: FlashbangEffectEvent['affectedPlayers'][0]): void {
    const now = Date.now();
    
    // Initialize effect state if it doesn't exist
    if (!player.effectState) {
      player.effectState = this.createDefaultEffectState();
    }
    
    // Apply the new flashbang effect
    player.effectState.flashbangIntensity = effectData.intensity;
    player.effectState.flashbangRecoveryPhase = 'blind';
    player.effectState.flashbangEndTime = now + effectData.duration;
    player.effectState.lastFlashTime = now;
    
    // Set impairment levels based on intensity
    player.effectState.visualImpairment = effectData.intensity;
    player.effectState.audioImpairment = effectData.intensity * 0.8;
    player.effectState.movementImpairment = effectData.intensity * 0.6;
    
    console.log(`⚡ Applied flashbang effect to ${player.id.substring(0, 8)}: ${effectData.intensity.toFixed(2)} intensity`);
  }
  
  /**
   * Update player effect states - handle recovery phases
   */
  updatePlayerEffects(player: PlayerState, deltaTime: number): void {
    if (!player.effectState || !player.isAlive) return;
    
    const now = Date.now();
    const config = GAME_CONFIG.WEAPONS.FLASHBANG;
    
    // Check if flashbang effect has ended
    if (now >= player.effectState.flashbangEndTime) {
      this.clearFlashbangEffect(player.effectState);
      return;
    }
    
    // Calculate which phase we're in
    const timeSinceFlash = now - player.effectState.lastFlashTime;
    const totalDuration = player.effectState.flashbangEndTime - player.effectState.lastFlashTime;
    const progress = timeSinceFlash / totalDuration;
    
    // Update recovery phase and impairment levels
    this.updateRecoveryPhase(player.effectState, progress);
  }
  
  /**
   * Check if there's a clear line of sight between two points
   */
  private hasLineOfSight(from: Vector2, to: Vector2, walls: Map<string, any>): boolean {
    for (const [wallId, wall] of walls) {
      if (this.lineIntersectsWall(from, to, wall)) {
        return false;
      }
    }
    return true;
  }
  
  /**
   * Check if a line segment intersects with a wall
   */
  private lineIntersectsWall(start: Vector2, end: Vector2, wall: any): boolean {
    // Skip fully destroyed walls
    if (wall.destructionMask) {
      const maskArray = Array.from(wall.destructionMask) as number[];
      if (maskArray.every(v => v === 255)) {
        return false; // Wall is completely destroyed
      }
    }
    
    // Simple AABB line intersection
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    
    // Calculate t values for intersection with wall boundaries
    let tMin = 0;
    let tMax = 1;
    
    // Check X boundaries
    if (Math.abs(dx) > 0.0001) {
      const t1 = (wall.position.x - start.x) / dx;
      const t2 = (wall.position.x + wall.width - start.x) / dx;
      
      const tMinX = Math.min(t1, t2);
      const tMaxX = Math.max(t1, t2);
      
      tMin = Math.max(tMin, tMinX);
      tMax = Math.min(tMax, tMaxX);
    } else {
      if (start.x < wall.position.x || start.x > wall.position.x + wall.width) {
        return false;
      }
    }
    
    // Check Y boundaries  
    if (Math.abs(dy) > 0.0001) {
      const t1 = (wall.position.y - start.y) / dy;
      const t2 = (wall.position.y + wall.height - start.y) / dy;
      
      const tMinY = Math.min(t1, t2);
      const tMaxY = Math.max(t1, t2);
      
      tMin = Math.max(tMin, tMinY);
      tMax = Math.min(tMax, tMaxY);
    } else {
      if (start.y < wall.position.y || start.y > wall.position.y + wall.height) {
        return false;
      }
    }
    
    // Check if there's a valid intersection
    if (tMin <= tMax && tMax >= 0 && tMin <= 1) {
      // Wall blocks line of sight
      return true;
    }
    
    return false;
  }
  
  /**
   * Calculate how directly a player was looking at the flash (0 = looking directly, 1 = looking away)
   */
  private calculateViewingAngle(playerPos: Vector2, playerRotation: number, flashPos: Vector2): number {
    // Calculate angle from player to flash
    const toFlashAngle = Math.atan2(flashPos.y - playerPos.y, flashPos.x - playerPos.x);
    
    // Calculate the difference between where player is looking and where flash is
    let angleDiff = Math.abs(toFlashAngle - playerRotation);
    
    // Normalize to [0, π]
    if (angleDiff > Math.PI) {
      angleDiff = 2 * Math.PI - angleDiff;
    }
    
    // Convert to 0-1 scale (0 = looking directly, 1 = looking completely away)
    return angleDiff / Math.PI;
  }
  
  /**
   * Calculate effect duration phases based on intensity
   */
  private calculateEffectPhases(intensity: number): { blindDuration: number; disorientedDuration: number; recoveringDuration: number } {
    const config = GAME_CONFIG.WEAPONS.FLASHBANG;
    
    const blindDuration = config.BLIND_DURATION_BASE * intensity;
    const disorientedDuration = config.DISORIENTED_DURATION_BASE * intensity;
    const recoveringDuration = config.RECOVERING_DURATION_BASE * intensity;
    
    return {
      blindDuration: Math.floor(blindDuration),
      disorientedDuration: Math.floor(disorientedDuration),
      recoveringDuration: Math.floor(recoveringDuration)
    };
  }
  
  /**
   * Update the recovery phase based on progress through the effect
   */
  private updateRecoveryPhase(effectState: PlayerEffectState, progress: number): void {
    const phases = this.calculateEffectPhases(effectState.flashbangIntensity);
    const totalDuration = phases.blindDuration + phases.disorientedDuration + phases.recoveringDuration;
    
    const blindProgress = phases.blindDuration / totalDuration;
    const disorientedProgress = (phases.blindDuration + phases.disorientedDuration) / totalDuration;
    
    if (progress < blindProgress) {
      // Blind phase
      effectState.flashbangRecoveryPhase = 'blind';
      effectState.visualImpairment = effectState.flashbangIntensity;
      effectState.audioImpairment = effectState.flashbangIntensity * 0.8;
      effectState.movementImpairment = effectState.flashbangIntensity * 0.6;
    } else if (progress < disorientedProgress) {
      // Disoriented phase
      effectState.flashbangRecoveryPhase = 'disoriented';
      const phaseProgress = (progress - blindProgress) / (disorientedProgress - blindProgress);
      effectState.visualImpairment = effectState.flashbangIntensity * (1 - phaseProgress * 0.7);
      effectState.audioImpairment = effectState.flashbangIntensity * 0.8 * (1 - phaseProgress * 0.5);
      effectState.movementImpairment = effectState.flashbangIntensity * 0.6 * (1 - phaseProgress * 0.3);
    } else {
      // Recovering phase
      effectState.flashbangRecoveryPhase = 'recovering';
      const phaseProgress = (progress - disorientedProgress) / (1 - disorientedProgress);
      effectState.visualImpairment = effectState.flashbangIntensity * 0.3 * (1 - phaseProgress);
      effectState.audioImpairment = effectState.flashbangIntensity * 0.4 * (1 - phaseProgress);
      effectState.movementImpairment = effectState.flashbangIntensity * 0.3 * (1 - phaseProgress);
    }
  }
  
  /**
   * Clear flashbang effect from player
   */
  private clearFlashbangEffect(effectState: PlayerEffectState): void {
    effectState.flashbangIntensity = 0;
    effectState.flashbangRecoveryPhase = 'normal';
    effectState.visualImpairment = 0;
    effectState.audioImpairment = 0;
    effectState.movementImpairment = 0;
  }
  
  /**
   * Create default effect state for a player
   */
  private createDefaultEffectState(): PlayerEffectState {
    return {
      flashbangIntensity: 0,
      flashbangRecoveryPhase: 'normal',
      flashbangEndTime: 0,
      visualImpairment: 0,
      audioImpairment: 0,
      movementImpairment: 0,
      lastFlashTime: 0
    };
  }
  
  /**
   * Calculate distance between two points
   */
  private calculateDistance(point1: Vector2, point2: Vector2): number {
    return Math.sqrt(
      Math.pow(point2.x - point1.x, 2) + 
      Math.pow(point2.y - point1.y, 2)
    );
  }
  
  /**
   * Get current effect intensity for a player (for UI/rendering)
   */
  getPlayerEffectIntensity(player: PlayerState): number {
    return player.effectState?.flashbangIntensity || 0;
  }
}

