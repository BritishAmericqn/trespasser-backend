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
    constructor() {
        this.engine = matter_js_1.default.Engine.create();
        this.world = this.engine.world;
        this.world.gravity.y = 0;
        console.log('PhysicsSystem initialized');
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
