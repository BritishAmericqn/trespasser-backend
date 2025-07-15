import Matter from 'matter-js';
import { GAME_CONFIG } from '../../shared/constants';

export class PhysicsSystem {
  private engine: Matter.Engine;
  private world: Matter.World;
  
  constructor() {
    this.engine = Matter.Engine.create();
    this.world = this.engine.world;
    this.world.gravity.y = 0;
    console.log('PhysicsSystem initialized');
  }
  
  update(delta: number): void {
    Matter.Engine.update(this.engine, delta);
  }
  
  addBody(body: Matter.Body): void {
    Matter.World.add(this.world, body);
  }
  
  removeBody(body: Matter.Body): void {
    Matter.World.remove(this.world, body);
  }
  
  destroy(): void {
    Matter.World.clear(this.world, false);
    Matter.Engine.clear(this.engine);
  }
}
