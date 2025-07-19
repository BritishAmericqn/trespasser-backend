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
export type WeaponType = 
  // Primary Weapons
  | 'rifle' 
  | 'smg' 
  | 'shotgun' 
  | 'battlerifle' 
  | 'sniperrifle'
  // Secondary Weapons
  | 'pistol' 
  | 'revolver' 
  | 'suppressedpistol'
  // Support Weapons
  | 'grenadelauncher' 
  | 'machinegun' 
  | 'antimaterialrifle'
  // Thrown Weapons
  | 'grenade' 
  | 'smokegrenade' 
  | 'flashbang' 
  | 'rocket';

export interface WeaponState {
  id: string;
  type: WeaponType;
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
  // Special weapon properties
  heatLevel?: number; // For machine gun overheating (0-100)
  isOverheated?: boolean; // Machine gun overheat state
  pelletCount?: number; // For shotgun
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
  orientation: 'horizontal' | 'vertical'; // NEW: Determined by width/height ratio
  destructionMask: Uint8Array; // 5 slices per wall
  material: 'concrete' | 'wood' | 'metal' | 'glass';
  maxHealth: number;
  sliceHealth: number[]; // health per slice
}

export interface ProjectileState {
  id: string;
  position: Vector2;
  velocity: Vector2;
  type: 'bullet' | 'rocket' | 'grenade' | 'grenadelauncher' | 'smokegrenade' | 'flashbang';
  ownerId: string;
  damage: number;
  timestamp: number;
  range: number;
  traveledDistance: number;
  isExploded: boolean;
  explosionRadius?: number;
  chargeLevel?: number; // for grenades
  fuseTime?: number; // for timed explosives
}

export interface GameState {
  players: Map<string, PlayerState>;
  walls: Map<string, WallState>;
  projectiles: ProjectileState[];
  timestamp: number;
  tickRate: number;
  vision?: {
    type: 'tiles' | 'polygon';
    viewAngle: number;
    position: Vector2;
    fogOpacity?: number; // Fog of war darkness level (0.0 = transparent, 1.0 = black)
  } & (
    | {
        type: 'tiles';
        visibleTiles: number[];  // Array of tile indices (y * 30 + x)
      }
    | {
        type: 'polygon';
        polygon: Vector2[];      // Visibility polygon vertices
        viewDirection: number;   // Player's view direction
        viewDistance: number;    // Maximum view distance
      }
  );
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
  weaponType: WeaponType;
  position: Vector2;
  direction: number; // rotation in radians
  isADS: boolean;
  timestamp: number;
  sequence: number;
  chargeLevel?: number; // For grenades: 1-5
  pelletCount?: number; // For shotgun: 8
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

// Penetration hit for bullets that pass through multiple targets
export interface PenetrationHit {
  targetType: 'player' | 'wall';
  targetId: string;
  hitPoint: Vector2;
  distance: number;
  wallSliceIndex?: number;
  damage: number; // Damage dealt to this target
  remainingDamage: number; // Damage remaining after this hit
}

// Machine gun heat update event
export interface WeaponHeatUpdateEvent {
  weaponType: 'machinegun';
  heatLevel: number; // 0-100
  isOverheated: boolean;
}

// Smoke grenade deployment event
export interface SmokeDeployedEvent {
  id: string;
  position: Vector2;
  radius: number;
  duration: number;
}

// Flashbang detonation event
export interface FlashbangDetonatedEvent {
  position: Vector2;
  affected: Array<{
    playerId: string;
    intensity: number; // 0-1
    duration: number; // milliseconds
  }>;
}

// Wall penetration event for anti-material rifle
export interface WallPenetratedEvent {
  wallIds: string[];
  positions: Vector2[];
  remainingDamage: number;
}

// Smoke zone for vision blocking
export interface SmokeZone {
  id: string;
  position: Vector2;
  radius: number;
  createdAt: number;
  duration: number;
  type: 'smoke';
}
