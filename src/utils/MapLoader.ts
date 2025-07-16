import Jimp from 'jimp';
import { DestructionSystem } from '../systems/DestructionSystem';
import { Vector2 } from '../../shared/types';

interface GridCell {
  x: number;
  y: number;
  color: string;
  type: 'wall' | 'spawn' | 'light' | 'empty';
  material?: string;
}

interface ProcessedWall {
  position: Vector2;
  width: number;
  height: number;
  material: 'concrete' | 'wood' | 'metal' | 'glass';
}

export class MapLoader {
  private static readonly GRID_SIZE = 10;
  private static readonly MAP_WIDTH_CELLS = 48;
  private static readonly MAP_HEIGHT_CELLS = 27;
  
  private static readonly COLOR_MAP: Record<string, string> = {
    // Wall Materials
    '#808080': 'concrete',
    '#8b4513': 'wood',
    '#404040': 'metal',
    '#87ceeb': 'glass',
    
    // Game Objects
    '#ff0000': 'spawn_red',
    '#0000ff': 'spawn_blue',
    '#ffff00': 'light',
    
    // Empty space
    '#ffffff': 'empty',
    '#000000': 'empty',
  };
  
  private destructionSystem: DestructionSystem;
  private grid: GridCell[][] = [];
  private spawns: Vector2[] = [];
  private lights: Vector2[] = [];
  
  constructor(destructionSystem: DestructionSystem) {
    this.destructionSystem = destructionSystem;
  }
  
  async loadMapFromFile(filename: string): Promise<void> {
    const mapPath = `./maps/${filename}.png`;
    
    try {
      // Load the image
      const image = await Jimp.read(mapPath);
      
      if (image.bitmap.width !== 480 || image.bitmap.height !== 270) {
        throw new Error(`Map must be exactly 480x270 pixels, got ${image.bitmap.width}x${image.bitmap.height}`);
      }
      
      // Downscale to 48x27 grid
      const scaledImage = image.resize(48, 27, Jimp.RESIZE_NEAREST_NEIGHBOR);
      
      // Convert to grid
      this.imageToGrid(scaledImage);
      
      // Process grid into walls
      this.processGridToWalls();
      
    } catch (error) {
      console.error(`❌ Failed to load map ${filename}:`, error);
      throw error;
    }
  }
  
  private imageToGrid(image: Jimp): void {
    this.grid = [];
    this.spawns = [];
    this.lights = [];
    
    for (let y = 0; y < 27; y++) {
      this.grid[y] = [];
      for (let x = 0; x < 48; x++) {
        const pixelColor = image.getPixelColor(x, y);
        const { r, g, b } = Jimp.intToRGBA(pixelColor);
        const hex = this.rgbToHex(r, g, b).toLowerCase();
        
        const cellType = MapLoader.COLOR_MAP[hex] || 'empty';
        
        const cell: GridCell = {
          x,
          y,
          color: hex,
          type: this.getTypeFromMaterial(cellType),
          material: this.isWallMaterial(cellType) ? cellType : undefined
        };
        
        this.grid[y][x] = cell;
        
        // Track special cells
        if (cellType === 'spawn_red' || cellType === 'spawn_blue') {
          this.spawns.push({ 
            x: x * MapLoader.GRID_SIZE + MapLoader.GRID_SIZE / 2, 
            y: y * MapLoader.GRID_SIZE + MapLoader.GRID_SIZE / 2 
          });
        } else if (cellType === 'light') {
          this.lights.push({ 
            x: x * MapLoader.GRID_SIZE + MapLoader.GRID_SIZE / 2, 
            y: y * MapLoader.GRID_SIZE + MapLoader.GRID_SIZE / 2 
          });
        }
      }
    }
  }
  
  private processGridToWalls(): void {
    const walls: ProcessedWall[] = [];
    const visited = new Set<string>();
    
    // Find horizontal walls
    for (let y = 0; y < 27; y++) {
      for (let x = 0; x < 48; x++) {
        const key = `${x},${y}`;
        if (visited.has(key)) continue;
        
        const cell = this.grid[y][x];
        if (cell.type !== 'wall') continue;
        
        // Find horizontal run
        let endX = x;
        while (endX < 48 && 
               this.grid[y][endX].type === 'wall' && 
               this.grid[y][endX].material === cell.material) {
          endX++;
        }
        
        const length = endX - x;
        // Only process runs of 2+ cells horizontally
        // Single cells will be handled as vertical walls (pillars) in the next pass
        if (length > 1) {
          // Mark cells as visited only if we're creating a wall
          for (let visitX = x; visitX < endX; visitX++) {
            visited.add(`${visitX},${y}`);
          }
          walls.push({
            position: { 
              x: x * MapLoader.GRID_SIZE, 
              y: y * MapLoader.GRID_SIZE 
            },
            width: length * MapLoader.GRID_SIZE,
            height: MapLoader.GRID_SIZE,
            material: cell.material as any
          });
        }
      }
    }
    
    // Find vertical walls (for remaining unvisited cells)
    for (let y = 0; y < 27; y++) {
      for (let x = 0; x < 48; x++) {
        const key = `${x},${y}`;
        if (visited.has(key)) continue;
        
        const cell = this.grid[y][x];
        if (cell.type !== 'wall') continue;
        
        // Find vertical run
        let endY = y;
        while (endY < 27 && 
               this.grid[endY][x].type === 'wall' && 
               this.grid[endY][x].material === cell.material &&
               !visited.has(`${x},${endY}`)) {
          visited.add(`${x},${endY}`);
          endY++;
        }
        
        const length = endY - y;
        if (length > 0) { // Allow single cells as vertical walls (pillars)
          walls.push({
            position: { 
              x: x * MapLoader.GRID_SIZE, 
              y: y * MapLoader.GRID_SIZE 
            },
            width: MapLoader.GRID_SIZE,
            height: length * MapLoader.GRID_SIZE,
            material: cell.material as any
          });
        }
      }
    }
    
    // Create walls in the destruction system
    walls.forEach(wall => {
      const createdWall = this.destructionSystem.createWall({
        position: wall.position,
        width: wall.width,
        height: wall.height,
        material: wall.material
      });
      
      // Don't mark any slices as destroyed - let all walls be fully intact
      // The previous code was marking bottom slices of vertical walls as destroyed,
      // causing collision to only work at the top of the wall
    });
  }
  
  private rgbToHex(r: number, g: number, b: number): string {
    return '#' + [r, g, b].map(x => {
      const hex = x.toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    }).join('');
  }
  
  private getTypeFromMaterial(material: string): 'wall' | 'spawn' | 'light' | 'empty' {
    if (this.isWallMaterial(material)) return 'wall';
    if (material.startsWith('spawn_')) return 'spawn';
    if (material === 'light') return 'light';
    return 'empty';
  }
  
  private isWallMaterial(material: string): boolean {
    return ['concrete', 'wood', 'metal', 'glass'].includes(material);
  }
  
  // Getters for game systems that need spawn/light positions
  getSpawnPositions(): Vector2[] {
    return [...this.spawns];
  }
  
  getLightPositions(): Vector2[] {
    return [...this.lights];
  }
} 