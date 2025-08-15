import { Vector2, SmokeZone } from '../../shared/types';
import { GAME_CONFIG } from '../../shared/constants';

export class SmokeZoneSystem {
  private smokeZones: Map<string, SmokeZone> = new Map();
  
  constructor() {
    console.log('SmokeZoneSystem initialized');
  }
  
  /**
   * Create a new smoke zone from a smoke grenade explosion
   */
  createSmokeZone(id: string, position: Vector2): SmokeZone {
    const config = GAME_CONFIG.WEAPONS.SMOKEGRENADE;
    const now = Date.now();
    
    // Random wind direction and speed variation
    const windDirection = Math.random() * 2 * Math.PI;
    const windSpeedVariation = 0.5 + Math.random() * 0.5; // 0.5x to 1x base speed
    
    const smokeZone: SmokeZone = {
      id,
      position: { ...position },
      radius: 5, // Start small
      maxRadius: config.SMOKE_RADIUS,
      createdAt: now,
      duration: config.SMOKE_DURATION,
      expansionTime: config.SMOKE_EXPANSION_TIME,
      density: 0.1, // Start with low density
      maxDensity: config.SMOKE_MAX_DENSITY,
      windDirection,
      windSpeed: config.SMOKE_WIND_SPEED * windSpeedVariation,
      driftPosition: { ...position },
      type: 'smoke'
    };
    
    this.smokeZones.set(id, smokeZone);
    console.log(`💨 Smoke zone created at (${position.x.toFixed(1)}, ${position.y.toFixed(1)}) with ID ${id}`);
    
    return smokeZone;
  }
  
  /**
   * Update all smoke zones - handle expansion, drift, and decay
   */
  update(deltaTime: number): void {
    const now = Date.now();
    const zonesToRemove: string[] = [];
    
    for (const [id, zone] of this.smokeZones) {
      const age = now - zone.createdAt;
      
      // Check if zone has expired
      if (age >= zone.duration) {
        zonesToRemove.push(id);
        continue;
      }
      
      // Update expansion (first few seconds)
      if (age < zone.expansionTime) {
        const expansionProgress = age / zone.expansionTime;
        zone.radius = zone.maxRadius * this.easeOutCubic(expansionProgress);
        zone.density = zone.maxDensity * this.easeInQuad(expansionProgress);
      } else {
        // Full size reached, start decay in final quarter of duration
        zone.radius = zone.maxRadius;
        const remainingTime = zone.duration - age;
        const decayTime = zone.duration * 0.25; // Last 25% of duration
        
        if (remainingTime < decayTime) {
          const decayProgress = 1 - (remainingTime / decayTime);
          zone.density = zone.maxDensity * (1 - this.easeInQuad(decayProgress));
        } else {
          zone.density = zone.maxDensity;
        }
      }
      
      // Apply wind drift
      const deltaSeconds = deltaTime / 1000;
      const driftX = Math.cos(zone.windDirection) * zone.windSpeed * deltaSeconds;
      const driftY = Math.sin(zone.windDirection) * zone.windSpeed * deltaSeconds;
      
      zone.driftPosition.x += driftX;
      zone.driftPosition.y += driftY;
      
      // Keep drift within game bounds with some margin
      zone.driftPosition.x = Math.max(zone.maxRadius, Math.min(GAME_CONFIG.GAME_WIDTH - zone.maxRadius, zone.driftPosition.x));
      zone.driftPosition.y = Math.max(zone.maxRadius, Math.min(GAME_CONFIG.GAME_HEIGHT - zone.maxRadius, zone.driftPosition.y));
    }
    
    // Remove expired zones
    for (const id of zonesToRemove) {
      this.smokeZones.delete(id);
      console.log(`💨 Smoke zone ${id} expired and removed`);
    }
  }
  
  /**
   * Calculate smoke opacity at a specific point
   * Returns 0-1 opacity value based on distance from smoke centers
   */
  calculateSmokeOpacityAtPoint(point: Vector2): number {
    let totalOpacity = 0;
    
    for (const zone of this.smokeZones.values()) {
      const distance = Math.sqrt(
        Math.pow(point.x - zone.driftPosition.x, 2) + 
        Math.pow(point.y - zone.driftPosition.y, 2)
      );
      
      if (distance <= zone.radius) {
        // Calculate opacity with falloff from center
        const distanceRatio = distance / zone.radius;
        const edgeFade = GAME_CONFIG.WEAPONS.SMOKEGRENADE.SMOKE_EDGE_FADE;
        
        // Smooth falloff: full density at center, edge fade at boundary
        const opacityMultiplier = 1 - (distanceRatio * (1 - edgeFade));
        const zoneOpacity = zone.density * opacityMultiplier;
        
        // Accumulate opacity (multiple smoke zones can stack)
        totalOpacity = Math.min(1.0, totalOpacity + zoneOpacity);
      }
    }
    
    return totalOpacity;
  }
  
  /**
   * Check if a line segment passes through smoke and calculate cumulative opacity
   * Used for vision ray calculations
   */
  calculateSmokeOpacityAlongRay(start: Vector2, end: Vector2, sampleCount: number = 10): number {
    if (this.smokeZones.size === 0) return 0;
    
    let maxOpacity = 0;
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    
    // Sample points along the ray
    for (let i = 0; i <= sampleCount; i++) {
      const t = i / sampleCount;
      const samplePoint = {
        x: start.x + dx * t,
        y: start.y + dy * t
      };
      
      const opacity = this.calculateSmokeOpacityAtPoint(samplePoint);
      maxOpacity = Math.max(maxOpacity, opacity);
      
      // Early exit if we hit very dense smoke
      if (opacity > 0.9) return opacity;
    }
    
    return maxOpacity;
  }
  
  /**
   * Get all active smoke zones
   */
  getSmokeZones(): SmokeZone[] {
    return Array.from(this.smokeZones.values());
  }
  
  /**
   * Remove a specific smoke zone
   */
  removeSmokeZone(id: string): boolean {
    return this.smokeZones.delete(id);
  }
  
  /**
   * Clear all smoke zones
   */
  clear(): void {
    this.smokeZones.clear();
  }
  
  /**
   * Get count of active smoke zones
   */
  getZoneCount(): number {
    return this.smokeZones.size;
  }
  
  // Easing functions for smooth animation
  private easeOutCubic(t: number): number {
    return 1 - Math.pow(1 - t, 3);
  }
  
  private easeInQuad(t: number): number {
    return t * t;
  }
  
  private easeInCubic(t: number): number {
    return t * t * t;
  }
}

