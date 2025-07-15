export interface Vector2 {
  x: number;
  y: number;
}

export interface Transform {
  position: Vector2;
  rotation: number;
  scale: Vector2;
}

// Extended weapon and ammo types
export interface WeaponState {
  id: string;
  type: 'rifle' | 'pistol' | 'grenade' | 'rocket';
  currentAmmo: number;
  reserveAmmo: number;
  maxAmmo: number;
  maxReserve: number;
  damage: number;
  fireRate: number; // rounds per minute
  reloadTime: number; // milliseconds
  isReloading: boolean;
  lastFireTime: number;
  accuracy: number; // 0-1, affects spread
  range: number; // pixels
}

export interface PlayerState {
  id: string;
  transform: Transform;
  velocity: Vector2;
  health: number;
  armor: number;
  team: 'red' | 'blue';
  weaponId: string;
  weapons: Map<string, WeaponState>;
  isAlive: boolean;
  movementState: 'idle' | 'walking' | 'running' | 'sneaking';
  isADS: boolean; // aim down sights
  lastDamageTime: number;
  kills: number;
  deaths: number;
  lastProcessedInput?: number; // For client-side prediction
}

export interface WallState {
  id: string;
  position: Vector2;
  width: number;
  height: number;
  destructionMask: Uint8Array; // 5 slices per wall
  material: 'concrete' | 'wood' | 'metal' | 'glass';
  maxHealth: number;
  sliceHealth: number[]; // health per slice
}

export interface ProjectileState {
  id: string;
  position: Vector2;
  velocity: Vector2;
  type: 'bullet' | 'rocket' | 'grenade';
  ownerId: string;
  damage: number;
  timestamp: number;
  range: number;
  traveledDistance: number;
  isExploded: boolean;
  explosionRadius?: number;
  chargeLevel?: number; // for grenades
}

export interface GameState {
  players: Map<string, PlayerState>;
  walls: Map<string, WallState>;
  projectiles: ProjectileState[];
  timestamp: number;
  tickRate: number;
}

// Extended input types for weapons
export interface InputState {
  keys: {
    w: boolean;
    a: boolean;
    s: boolean;
    d: boolean;
    shift: boolean;
    ctrl: boolean;
    r: boolean; // reload
    g: boolean; // grenade
    '1': boolean; // weapon slot 1
    '2': boolean; // weapon slot 2
    '3': boolean; // weapon slot 3
    '4': boolean; // weapon slot 4
  };
  mouse: {
    x: number;
    y: number;
    buttons: number;
    leftPressed: boolean;
    rightPressed: boolean;
    leftReleased: boolean;
    rightReleased: boolean;
  };
  sequence: number;
  timestamp: number;
}

// Weapon event types
export interface WeaponFireEvent {
  playerId: string;
  weaponType: 'rifle' | 'pistol' | 'grenade' | 'rocket';
  position: Vector2;
  direction: number; // rotation in radians
  isADS: boolean;
  timestamp: number;
  sequence: number;
  chargeLevel?: number; // For grenades: 1-5
}

export interface WeaponHitEvent {
  projectileId: string;
  position: Vector2;
  targetId?: string; // player hit
  wallId?: string; // wall hit
  damage: number;
  timestamp: number;
}

export interface WeaponReloadEvent {
  playerId: string;
  weaponType: string;
  timestamp: number;
}

export interface WeaponSwitchEvent {
  playerId: string;
  fromWeapon: string;
  toWeapon: string;
  timestamp: number;
}

export interface GrenadeThrowEvent {
  playerId: string;
  position: Vector2;
  direction: number;
  chargeLevel: number; // 1-5
  timestamp: number;
}

export interface WallDamageEvent {
  wallId: string;
  position: Vector2;
  damage: number;
  sliceIndex: number;
  newHealth: number;
  isDestroyed: boolean;
  timestamp: number;
}

export interface PlayerDamageEvent {
  playerId: string;
  damage: number;
  damageType: 'bullet' | 'explosion';
  sourcePlayerId: string;
  position: Vector2;
  newHealth: number;
  isKilled: boolean;
  timestamp: number;
}

export interface ExplosionEvent {
  position: Vector2;
  radius: number;
  damage: number;
  sourcePlayerId: string;
  timestamp: number;
}

// Hitscan result for instant bullet hits
export interface HitscanResult {
  hit: boolean;
  hitPoint: Vector2;
  distance: number;
  targetType: 'player' | 'wall' | 'none';
  targetId?: string;
  wallSliceIndex?: number;
}
