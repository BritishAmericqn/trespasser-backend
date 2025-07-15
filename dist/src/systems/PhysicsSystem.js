"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PhysicsSystem = void 0;
const matter_js_1 = __importDefault(require("matter-js"));
class PhysicsSystem {
    engine;
    world;
    collisionCallbacks = new Map();
    constructor() {
        this.engine = matter_js_1.default.Engine.create();
        this.world = this.engine.world;
        this.world.gravity.y = 0;
        // Improve collision detection for small/slow objects
        this.engine.positionIterations = 20; // Much higher for slow grenades
        this.engine.velocityIterations = 20; // Much higher for slow grenades
        this.engine.constraintIterations = 10; // Much higher for slow grenades
        // Set up collision events
        matter_js_1.default.Events.on(this.engine, 'collisionStart', (event) => {
            this.handleCollisionStart(event);
        });
        console.log('PhysicsSystem initialized with collision detection');
    }
    handleCollisionStart(event) {
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
    registerCollisionCallback(id, callback) {
        this.collisionCallbacks.set(id, callback);
    }
    unregisterCollisionCallback(id) {
        this.collisionCallbacks.delete(id);
    }
    update(delta) {
        matter_js_1.default.Engine.update(this.engine, delta);
    }
    addBody(body) {
        matter_js_1.default.World.add(this.world, body);
    }
    removeBody(body) {
        matter_js_1.default.World.remove(this.world, body);
    }
    destroy() {
        matter_js_1.default.World.clear(this.world, false);
        matter_js_1.default.Engine.clear(this.engine);
    }
}
exports.PhysicsSystem = PhysicsSystem;
