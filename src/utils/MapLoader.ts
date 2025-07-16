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
  activeSlices: number;
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
      console.log(`📍 Loading map: ${mapPath}`);
      
      // Load the 480x270 PNG
      const image = await Jimp.read(mapPath);
      
      if (image.bitmap.width !== 480 || image.bitmap.height !== 270) {
        throw new Error(`Map must be exactly 480x270 pixels, got ${image.bitmap.width}x${image.bitmap.height}`);
      }
      
      // Downscale to 48x27 grid
      const scaledImage = image.resize(48, 27, Jimp.RESIZE_NEAREST_NEIGHBOR);
      
      // Convert to grid
      this.imageToGrid(scaledImage);
      
      // Process grid into walls
      const walls = this.processGrid();
      
      // Create walls in game
      this.createWalls(walls);
      
      // Log results
      console.log(`✅ Map loaded successfully:`);
      console.log(`   - Walls: ${walls.length}`);
      console.log(`   - Spawns: ${this.spawns.length} (Red: ${this.spawns.filter((_, i) => this.grid[Math.floor(i / 48)][i % 48].color === '#ff0000').length}, Blue: ${this.spawns.filter((_, i) => this.grid[Math.floor(i / 48)][i % 48].color === '#0000ff').length})`);
      console.log(`   - Lights: ${this.lights.length} (placeholders for future)`);
      
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
  
  private processGrid(): ProcessedWall[] {
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
          visited.add(`${endX},${y}`);
          endX++;
        }
        
        const length = endX - x;
        if (length > 0) {
          walls.push({
            position: { 
              x: x * MapLoader.GRID_SIZE, 
              y: y * MapLoader.GRID_SIZE 
            },
            width: length * MapLoader.GRID_SIZE,
            height: MapLoader.GRID_SIZE,
            material: cell.material as any,
            activeSlices: this.calculateActiveSlices(length * MapLoader.GRID_SIZE)
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
        if (length > 1) { // Only create vertical walls if more than 1 cell
          walls.push({
            position: { 
              x: x * MapLoader.GRID_SIZE, 
              y: y * MapLoader.GRID_SIZE 
            },
            width: MapLoader.GRID_SIZE,
            height: length * MapLoader.GRID_SIZE,
            material: cell.material as any,
            activeSlices: this.calculateActiveSlices(length * MapLoader.GRID_SIZE)
          });
        }
      }
    }
    
    return walls;
  }
  
  private createWalls(walls: ProcessedWall[]): void {
    for (const wall of walls) {
      const createdWall = this.destructionSystem.createWall({
        position: wall.position,
        width: wall.width,
        height: wall.height,
        material: wall.material
      });
      
      // Set active slices using the destruction mask trick
      if (wall.activeSlices < 5) {
        for (let i = 0; i < wall.activeSlices; i++) {
          createdWall.destructionMask[i] = 0; // Active
        }
        for (let i = wall.activeSlices; i < 5; i++) {
          createdWall.destructionMask[i] = 1; // Non-existent
        }
      }
    }
  }
  
  private calculateActiveSlices(pixelLength: number): number {
    // Each slice represents roughly 10 pixels
    // But we cap at 5 slices max
    if (pixelLength <= 10) return 1;
    if (pixelLength <= 20) return 2;
    if (pixelLength <= 30) return 3;
    if (pixelLength <= 40) return 4;
    return 5;
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