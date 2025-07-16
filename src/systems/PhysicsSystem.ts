import Matter from 'matter-js';
import { GAME_CONFIG } from '../../shared/constants';

export class PhysicsSystem {
  private engine: Matter.Engine;
  private world: Matter.World;
  private collisionCallbacks: Map<string, (event: Matter.IEventCollision<Matter.Engine>) => void> = new Map();
  private activeBodies: Set<string> = new Set(); // Track bodies that need physics
  
  constructor() {
    this.engine = Matter.Engine.create();
    this.world = this.engine.world;
    this.world.gravity.y = 0;
    
    // Improve collision detection for small/slow objects
    this.engine.positionIterations = 20;  // Much higher for slow grenades
    this.engine.velocityIterations = 20;  // Much higher for slow grenades
    this.engine.constraintIterations = 10; // Much higher for slow grenades
    
    // Set up collision events
    Matter.Events.on(this.engine, 'collisionStart', (event) => {
      this.handleCollisionStart(event);
    });
    
    console.log('PhysicsSystem initialized with collision detection');
  }
  
  private handleCollisionStart(event: Matter.IEventCollision<Matter.Engine>): void {
    const pairs = event.pairs;
    
    for (const pair of pairs) {
      const { bodyA, bodyB } = pair;
      
      // Check for grenade-wall collisions
      if ((bodyA.label.startsWith('grenade:') && bodyB.label.startsWith('wall:')) ||
          (bodyB.label.startsWith('grenade:') && bodyA.label.startsWith('wall:'))) {
        
        const grenadeBody = bodyA.label.startsWith('grenade:') ? bodyA : bodyB;
        const wallBody = bodyA.label.startsWith('wall:') ? bodyA : bodyB;
        
        // Extract IDs from labels
        const grenadeId = grenadeBody.label.split(':')[1];
        const wallId = wallBody.label.split(':')[1];
        
        // Call registered callback if exists
        const callback = this.collisionCallbacks.get(grenadeId);
        if (callback) {
          callback(event);
        }
        
        console.log(`💥 Grenade ${grenadeId} collided with wall ${wallId}`);
      }
    }
  }
  
  registerCollisionCallback(id: string, callback: (event: Matter.IEventCollision<Matter.Engine>) => void): void {
    this.collisionCallbacks.set(id, callback);
  }
  
  unregisterCollisionCallback(id: string): void {
    this.collisionCallbacks.delete(id);
  }
  
  update(delta: number): void {
    // CRITICAL PERFORMANCE: Only run physics if bodies are actually moving
    if (this.activeBodies.size > 0) {
      Matter.Engine.update(this.engine, delta);
    }
  }
  
  // Track bodies that need physics updates
  addActiveBody(id: string): void {
    this.activeBodies.add(id);
  }
  
  removeActiveBody(id: string): void {
    this.activeBodies.delete(id);
  }
  
  getActiveBodiesCount(): number {
    return this.activeBodies.size;
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
