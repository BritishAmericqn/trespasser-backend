import { WallState, WallDamageEvent, Vector2 } from '../../shared/types';
import { GAME_CONFIG } from '../../shared/constants';
import Matter from 'matter-js';
import { PhysicsSystem } from './PhysicsSystem';
import { 
  determineWallOrientation, 
  getSlicePosition as getSlicePositionHelper,
  isPointInSlice,
  calculateSliceIndex,
  shouldSliceAllowVision
} from '../utils/wallSliceHelpers';
import { MapLoader } from '../utils/MapLoader';

export class DestructionSystem {
  private walls: Map<string, WallState> = new Map();
  private wallBodies: Map<string, Matter.Body> = new Map();
  private wallIdCounter: number = 0;
  private spawnPositions: Vector2[] = [];
  private teamSpawnPositions: { red: Vector2[], blue: Vector2[] } = { red: [], blue: [] };
  
  constructor(private physics?: PhysicsSystem) {
    // Don't initialize in constructor - will be called separately
  }
  
  // Initialize walls - must be called after construction
  async initialize(): Promise<void> {
    await this.initializeWalls();
  }
  
  // Initialize walls - either from map file or test walls
  private async initializeWalls(): Promise<void> {
    // Check if we should load a map file
    const mapFile = process.env.MAP_FILE || process.env.LOAD_MAP;
    
    if (mapFile) {
      try {
        const mapLoader = new MapLoader(this);
        await mapLoader.loadMapFromFile(mapFile);
        
        // Store spawn positions from the map
        this.spawnPositions = mapLoader.getSpawnPositions();
        this.teamSpawnPositions = mapLoader.getTeamSpawnPositions();
        console.log(`📍 Loaded spawn positions - Red: ${this.teamSpawnPositions.red.length}, Blue: ${this.teamSpawnPositions.blue.length}`);
        
      } catch (error) {
        console.error(`Failed to load map file, falling back to test walls:`, error);
        this.initializeTestWalls();
      }
    } else {
      console.log('📍 No map file specified, using test walls');
      this.initializeTestWalls();
    }
  }
  
  // Initialize test walls for development
  private initializeTestWalls(): void {
    // Mix of horizontal and vertical walls for testing
    
    // Horizontal walls (width > height)
    this.createWall({
      position: { x: 200, y: 100 },
      width: 60,
      height: 15,
      material: 'concrete'
    });
    
    // Vertical wall (height > width)
    this.createWall({
      position: { x: 100, y: 150 },
      width: 15,
      height: 60,
      material: 'wood'
    });
    
    // Horizontal wall
    this.createWall({
      position: { x: 300, y: 150 },
      width: 60,
      height: 15,
      material: 'metal'
    });
    
    // Vertical wall
    this.createWall({
      position: { x: 150, y: 30 },
      width: 15,
      height: 75,
      material: 'glass'
    });
    
    // Additional mixed walls for testing
    // Vertical wall
    this.createWall({
      position: { x: 320, y: 50 },
      width: 15,
      height: 60,
      material: 'concrete'
    });
    
    // Horizontal wall
    this.createWall({
      position: { x: 280, y: 120 },
      width: 90,
      height: 15,
      material: 'wood'
    });
    
    // Vertical wall
    this.createWall({
      position: { x: 380, y: 100 },
      width: 15,
      height: 45,
      material: 'metal'
    });
    
    // Horizontal wall
    this.createWall({
      position: { x: 250, y: 180 },
      width: 75,
      height: 15,
      material: 'glass'
    });
    
    // Create boundary walls for physics collisions
    // Top boundary (horizontal)
    this.createWall({
      position: { x: 0, y: -10 },
      width: GAME_CONFIG.GAME_WIDTH,
      height: 10,
      material: 'concrete'
    });
    
    // Bottom boundary (horizontal)
    this.createWall({
      position: { x: 0, y: GAME_CONFIG.GAME_HEIGHT },
      width: GAME_CONFIG.GAME_WIDTH,
      height: 10,
      material: 'concrete'
    });
    
    // Left boundary (vertical)
    this.createWall({
      position: { x: -10, y: 0 },
      width: 10,
      height: GAME_CONFIG.GAME_HEIGHT,
      material: 'concrete'
    });
    
    // Right boundary (vertical)
    this.createWall({
      position: { x: GAME_CONFIG.GAME_WIDTH, y: 0 },
      width: 10,
      height: GAME_CONFIG.GAME_HEIGHT,
      material: 'concrete'
    });
    
    // console.log(`🧱 Initialized ${this.walls.size} walls (including boundaries)`);
  }
  
  // Create a new wall
  createWall(params: {
    position: Vector2;
    width: number;
    height: number;
    material: 'concrete' | 'wood' | 'metal' | 'glass';
  }): WallState {
    const wallId = `wall_${++this.wallIdCounter}`;
    
    // Determine orientation based on dimensions
    const orientation = determineWallOrientation(params.width, params.height);
    
    // Calculate slice health based on material
    const materialMultiplier = GAME_CONFIG.DESTRUCTION.MATERIAL_MULTIPLIERS[params.material.toUpperCase() as keyof typeof GAME_CONFIG.DESTRUCTION.MATERIAL_MULTIPLIERS];
    const sliceHealth = GAME_CONFIG.DESTRUCTION.SLICE_HEALTH * materialMultiplier;
    
    const wall: WallState = {
      id: wallId,
      position: { ...params.position },
      width: params.width,
      height: params.height,
      orientation: orientation, // Set orientation based on dimensions
      destructionMask: new Uint8Array(GAME_CONFIG.DESTRUCTION.WALL_SLICES),
      material: params.material,
      maxHealth: sliceHealth,
      sliceHealth: Array(GAME_CONFIG.DESTRUCTION.WALL_SLICES).fill(sliceHealth)
    };
    
    // Initialize destruction mask (0 = intact, 1 = destroyed)
    wall.destructionMask.fill(0);
    
    this.walls.set(wallId, wall);
    
    // Create physics body for the wall if physics system is available
    if (this.physics) {
      const body = Matter.Bodies.rectangle(
        params.position.x + params.width / 2,
        params.position.y + params.height / 2,
        params.width,
        params.height,
        {
          isStatic: true,
          friction: 0.8,
          restitution: 0.5,
          label: `wall:${wallId}`,
          render: { visible: false }
        }
      );
      
      this.physics.addBody(body);
      this.wallBodies.set(wallId, body);
      // console.log(`🧱 Created physics body for wall ${wallId}`);
    }
    
    return wall;
  }
  
  // Apply damage to a wall slice
  applyDamage(wallId: string, sliceIndex: number, damage: number): WallDamageEvent | null {
    const wall = this.walls.get(wallId);
    if (!wall) {
      return null;
    }
    
    // Validate slice index
    if (sliceIndex < 0 || sliceIndex >= GAME_CONFIG.DESTRUCTION.WALL_SLICES) {
      return null;
    }
    
    // Check if slice already has no health
    if (wall.sliceHealth[sliceIndex] <= 0) {
      return null;
    }
    
    // Apply damage
    const currentHealth = wall.sliceHealth[sliceIndex];
    const newHealth = Math.max(0, currentHealth - damage);
    wall.sliceHealth[sliceIndex] = newHealth;
    
    // Check if slice is destroyed
    const isDestroyed = newHealth <= 0;
    
    // Update bitmask based on health-based visibility logic
    // For soft walls: transparent at 50% health, for hard walls: only when fully destroyed
    const shouldAllowVision = shouldSliceAllowVision(wall.material, newHealth, wall.maxHealth);
    wall.destructionMask[sliceIndex] = shouldAllowVision ? 1 : 0;
    
    return {
      wallId,
      position: this.getSlicePosition(wall, sliceIndex),
      damage,
      sliceIndex,
      newHealth,
      isDestroyed,
      timestamp: Date.now()
    };
  }
  
  // Get the position of a specific slice
  private getSlicePosition(wall: WallState, sliceIndex: number): Vector2 {
    return getSlicePositionHelper(wall, sliceIndex);
  }
  
  // Check if a wall slice is destroyed (for vision purposes)
  isSliceDestroyed(wallId: string, sliceIndex: number): boolean {
    const wall = this.walls.get(wallId);
    if (!wall || sliceIndex < 0 || sliceIndex >= GAME_CONFIG.DESTRUCTION.WALL_SLICES) {
      return false;
    }
    // Note: This checks vision mask, not physical destruction
    // For physical collision, use isSlicePhysicallyIntact() instead
    return wall.destructionMask[sliceIndex] === 1;
  }
  
  // Check if entire wall is destroyed
  isWallDestroyed(wallId: string): boolean {
    const wall = this.walls.get(wallId);
    if (!wall) return false;
    
    // Wall is destroyed if all slices are destroyed
    for (let i = 0; i < GAME_CONFIG.DESTRUCTION.WALL_SLICES; i++) {
      if (wall.destructionMask[i] === 0) {
        return false;
      }
    }
    return true;
  }
  
  // Get wall health percentage
  getWallHealth(wallId: string): number {
    const wall = this.walls.get(wallId);
    if (!wall) return 0;
    
    const totalHealth = wall.sliceHealth.reduce((sum, health) => sum + health, 0);
    const maxTotalHealth = wall.maxHealth * GAME_CONFIG.DESTRUCTION.WALL_SLICES;
    
    return totalHealth / maxTotalHealth;
  }
  
  // Get slice health percentage
  getSliceHealth(wallId: string, sliceIndex: number): number {
    const wall = this.walls.get(wallId);
    if (!wall || sliceIndex < 0 || sliceIndex >= GAME_CONFIG.DESTRUCTION.WALL_SLICES) {
      return 0;
    }
    
    return wall.sliceHealth[sliceIndex] / wall.maxHealth;
  }
  
  // Remove a wall completely
  removeWall(wallId: string): boolean {
    // Remove physics body if it exists
    if (this.physics) {
      const body = this.wallBodies.get(wallId);
      if (body) {
        this.physics.removeBody(body);
        this.wallBodies.delete(wallId);
      }
    }
    
    return this.walls.delete(wallId);
  }
  
  // Get all walls
  getWalls(): Map<string, WallState> {
    return this.walls;
  }
  
  // Get wall by ID
  getWall(wallId: string): WallState | undefined {
    return this.walls.get(wallId);
  }
  
  // Check if a point is inside a wall slice
  isPointInWallSlice(position: Vector2, wallId: string, sliceIndex: number): boolean {
    const wall = this.walls.get(wallId);
    if (!wall || sliceIndex < 0 || sliceIndex >= GAME_CONFIG.DESTRUCTION.WALL_SLICES) {
      return false;
    }
    
    // Check if slice is destroyed
    if (wall.sliceHealth[sliceIndex] <= 0) {
      return false;
    }
    
    return isPointInSlice(wall, position, sliceIndex);
  }
  
  // Check if a point is inside any wall slice
  isPointInAnyWall(position: Vector2): { hit: boolean; wall?: WallState; sliceIndex?: number } {
    for (const [wallId, wall] of this.walls) {
      // Quick AABB check first
      if (
        position.x >= wall.position.x &&
        position.x <= wall.position.x + wall.width &&
        position.y >= wall.position.y &&
        position.y <= wall.position.y + wall.height
      ) {
        // Check each slice
        for (let sliceIndex = 0; sliceIndex < GAME_CONFIG.DESTRUCTION.WALL_SLICES; sliceIndex++) {
          if (this.isPointInWallSlice(position, wallId, sliceIndex)) {
            return { hit: true, wall, sliceIndex };
          }
        }
      }
    }
    return { hit: false };
  }
  
  // Get walls within a radius of a point
  getWallsInRadius(position: Vector2, radius: number): WallState[] {
    const wallsInRadius: WallState[] = [];
    
    for (const wall of this.walls.values()) {
      // Calculate distance from point to wall center
      const wallCenter = {
        x: wall.position.x + wall.width / 2,
        y: wall.position.y + wall.height / 2
      };
      
      const distance = Math.sqrt(
        Math.pow(position.x - wallCenter.x, 2) +
        Math.pow(position.y - wallCenter.y, 2)
      );
      
      if (distance <= radius) {
        wallsInRadius.push(wall);
      }
    }
    
    return wallsInRadius;
  }
  
  // Apply explosion damage to walls in radius
  applyExplosionDamage(position: Vector2, radius: number, damage: number): WallDamageEvent[] {
    const damageEvents: WallDamageEvent[] = [];
    const wallsInRadius = this.getWallsInRadius(position, radius);
    
    for (const wall of wallsInRadius) {
      // Calculate damage falloff based on distance
      const wallCenter = {
        x: wall.position.x + wall.width / 2,
        y: wall.position.y + wall.height / 2
      };
      
      const distance = Math.sqrt(
        Math.pow(position.x - wallCenter.x, 2) +
        Math.pow(position.y - wallCenter.y, 2)
      );
      
      const falloffFactor = Math.max(0, 1 - (distance / radius));
      const finalDamage = damage * falloffFactor;
      
      if (finalDamage > 0) {
        // Apply damage to multiple slices based on explosion radius
        const slicesAffected = Math.ceil(radius / (wall.width / GAME_CONFIG.DESTRUCTION.WALL_SLICES));
        const centerSlice = Math.floor(GAME_CONFIG.DESTRUCTION.WALL_SLICES / 2);
        
        for (let i = 0; i < slicesAffected; i++) {
          const sliceIndex = Math.max(0, Math.min(GAME_CONFIG.DESTRUCTION.WALL_SLICES - 1, centerSlice + i - Math.floor(slicesAffected / 2)));
          
          const damageEvent = this.applyDamage(wall.id, sliceIndex, finalDamage);
          if (damageEvent) {
            damageEvents.push(damageEvent);
          }
        }
      }
    }
    
    return damageEvents;
  }
  
  // Get wall damage visualization data
  getWallDamageVisualization(wallId: string): {
    sliceStates: Array<{
      sliceIndex: number;
      healthPercent: number;
      isDestroyed: boolean;
      damageLevel: 'none' | 'light' | 'medium' | 'heavy' | 'destroyed';
    }>;
  } | null {
    const wall = this.walls.get(wallId);
    if (!wall) return null;
    
    const sliceStates = [];
    
    for (let i = 0; i < GAME_CONFIG.DESTRUCTION.WALL_SLICES; i++) {
      const healthPercent = this.getSliceHealth(wallId, i);
      const isDestroyed = this.isSliceDestroyed(wallId, i);
      
      let damageLevel: 'none' | 'light' | 'medium' | 'heavy' | 'destroyed';
      if (isDestroyed) {
        damageLevel = 'destroyed';
      } else if (healthPercent > 0.75) {
        damageLevel = 'none';
      } else if (healthPercent > 0.5) {
        damageLevel = 'light';
      } else if (healthPercent > 0.25) {
        damageLevel = 'medium';
      } else {
        damageLevel = 'heavy';
      }
      
      sliceStates.push({
        sliceIndex: i,
        healthPercent,
        isDestroyed,
        damageLevel
      });
    }
    
    return { sliceStates };
  }
  
  // Repair a wall slice (for testing/admin purposes)
  repairSlice(wallId: string, sliceIndex: number, healthToRestore: number = 100): boolean {
    const wall = this.walls.get(wallId);
    if (!wall || sliceIndex < 0 || sliceIndex >= GAME_CONFIG.DESTRUCTION.WALL_SLICES) {
      return false;
    }
    
    const currentHealth = wall.sliceHealth[sliceIndex];
    
    // Determine max allowed health
    let maxAllowedHealth = wall.maxHealth;
    if (wall.initialSliceHealth && wall.initialSliceHealth[sliceIndex] !== undefined) {
      // Don't repair beyond initial state
      maxAllowedHealth = wall.initialSliceHealth[sliceIndex];
    }
    
    const newHealth = Math.min(maxAllowedHealth, currentHealth + healthToRestore);
    wall.sliceHealth[sliceIndex] = newHealth;
    
    // Update bitmask based on health-based visibility logic
    const shouldAllowVision = shouldSliceAllowVision(wall.material, newHealth, wall.maxHealth);
    wall.destructionMask[sliceIndex] = shouldAllowVision ? 1 : 0;
    
    return true;
  }
  
  // Repair entire wall (for testing/admin purposes)
  repairWall(wallId: string): boolean {
    const wall = this.walls.get(wallId);
    if (!wall) return false;
    
    // Restore slices - respect initial state if it exists
    for (let i = 0; i < GAME_CONFIG.DESTRUCTION.WALL_SLICES; i++) {
      if (wall.initialSliceHealth) {
        // Don't repair beyond initial state
        wall.sliceHealth[i] = wall.initialSliceHealth[i];
      } else {
        // No initial state - repair to full health
        wall.sliceHealth[i] = wall.maxHealth;
      }
      
      // Update destruction mask
      const shouldAllowVision = shouldSliceAllowVision(wall.material, wall.sliceHealth[i], wall.maxHealth);
      wall.destructionMask[i] = shouldAllowVision ? 1 : 0;
    }
    
    return true;
  }
  
  // Capture the initial state of a wall (used for partial walls from map loading)
  captureWallInitialState(wallId: string): void {
    const wall = this.walls.get(wallId);
    if (!wall) return;
    
    // Store a snapshot of the current slice health as the initial state
    wall.initialSliceHealth = [...wall.sliceHealth];
  }
  
  // Get destruction statistics
  getDestructionStats(): {
    totalWalls: number;
    destroyedWalls: number;
    totalSlices: number;
    destroyedSlices: number;
    overallDestructionPercentage: number;
  } {
    const totalWalls = this.walls.size;
    let destroyedWalls = 0;
    let totalSlices = 0;
    let destroyedSlices = 0;
    
    for (const [wallId, wall] of this.walls) {
      totalSlices += GAME_CONFIG.DESTRUCTION.WALL_SLICES;
      
      let wallDestroyed = true;
      for (let i = 0; i < GAME_CONFIG.DESTRUCTION.WALL_SLICES; i++) {
        if (wall.destructionMask[i] === 1) {
          destroyedSlices++;
        } else {
          wallDestroyed = false;
        }
      }
      
      if (wallDestroyed) {
        destroyedWalls++;
      }
    }
    
    return {
      totalWalls,
      destroyedWalls,
      totalSlices,
      destroyedSlices,
      overallDestructionPercentage: totalSlices > 0 ? (destroyedSlices / totalSlices) * 100 : 0
    };
  }
  
  // Clear all walls
  clear(): void {
    this.walls.clear();
    this.wallIdCounter = 0;
  }
  
  // Reset all walls to their initial state
  resetAllWalls(): void {
    for (const wall of this.walls.values()) {
      if (wall.initialSliceHealth) {
        // Restore to initial state (preserves pre-destroyed slices from map)
        for (let i = 0; i < GAME_CONFIG.DESTRUCTION.WALL_SLICES; i++) {
          wall.sliceHealth[i] = wall.initialSliceHealth[i];
          
          // Update destruction mask based on the initial health
          const shouldAllowVision = shouldSliceAllowVision(wall.material, wall.sliceHealth[i], wall.maxHealth);
          wall.destructionMask[i] = shouldAllowVision ? 1 : 0;
        }
      } else {
        // No initial state - repair to full health
        this.repairWall(wall.id);
      }
    }
  }

  // Get spawn positions from loaded map
  getSpawnPositions(): Vector2[] {
    return [...this.spawnPositions];
  }
  
  // Get team-specific spawn positions from loaded map
  getTeamSpawnPositions(): { red: Vector2[], blue: Vector2[] } {
    return {
      red: [...this.teamSpawnPositions.red],
      blue: [...this.teamSpawnPositions.blue]
    };
  }
} 