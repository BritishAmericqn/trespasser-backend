export interface Vector2 {
  x: number;
  y: number;
}

export interface Transform {
  position: Vector2;
  rotation: number;
  scale: Vector2;
}

export interface PlayerState {
  id: string;
  transform: Transform;
  velocity: Vector2;
  health: number;
  armor: number;
  team: 'red' | 'blue';
  weaponId: string;
  isAlive: boolean;
  movementState: 'idle' | 'walking' | 'running' | 'sneaking';
}

export interface WallState {
  id: string;
  position: Vector2;
  width: number;
  height: number;
  destructionMask: Uint8Array;
  material: 'concrete' | 'wood' | 'metal' | 'glass';
}

export interface ProjectileState {
  id: string;
  position: Vector2;
  velocity: Vector2;
  type: 'bullet' | 'rocket' | 'grenade';
  ownerId: string;
  damage: number;
  timestamp: number;
}

export interface GameState {
  players: Map<string, PlayerState>;
  walls: Map<string, WallState>;
  projectiles: ProjectileState[];
  timestamp: number;
  tickRate: number;
}

export interface InputState {
  keys: {
    w: boolean;
    a: boolean;
    s: boolean;
    d: boolean;
    shift: boolean;
    ctrl: boolean;
  };
  mouse: {
    x: number;
    y: number;
    buttons: number;
  };
  sequence: number;
  timestamp: number;
}
