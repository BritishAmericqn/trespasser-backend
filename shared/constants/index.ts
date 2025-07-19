export const GAME_CONFIG = {
  GAME_WIDTH: 480,
  GAME_HEIGHT: 270,
  SCALE_FACTOR: 4,
  SERVER_URL: process.env.VITE_SERVER_URL || 'http://localhost:3000',
  TICK_RATE: 60,
  NETWORK_RATE: 20,
  PLAYER_SPEED_SNEAK: 50,
  PLAYER_SPEED_WALK: 100,
  PLAYER_SPEED_RUN: 150,
  PLAYER_SIZE: 12,
  PLAYER_HEALTH: 100,
  WALL_TILE_SIZE: 15,
  WALL_SLICE_WIDTH: 3,
  WALL_SLICES_PER_TILE: 5,
  WALL_HEALTH_PER_SLICE: 100,
  VISION_RANGE: 60, // Reduced from 100 for performance
  VISION_ANGLE: 90,
  VISION_RAYS: 45,
  HOLE_VISION_ANGLE: 15,
  
  // Vision system configuration
  VISION: {
    FOG_OPACITY: 0.64, // Reduced by 20% from 0.8 - less darkness for unseen areas
    VIEW_DISTANCE: 60,
    VIEW_ANGLE_DEGREES: 90,
    TILE_SIZE: 8, // For tile-based vision fallback
  },
  
  WEAPON_BULLET_SPEED: 500,
  WEAPON_BULLET_DAMAGE: 25,
  WEAPON_ROCKET_SPEED: 200,
  WEAPON_ROCKET_DAMAGE: 150,
  WEAPON_ROCKET_RADIUS: 30,
  AUDIO_FALLOFF_DISTANCE: 200,
  AUDIO_WALL_MUFFLE_FACTOR: 0.5,
  PHYSICS_STEP: 1000 / 60,
  
  // Weapon configurations
  WEAPONS: {
    // Primary Weapons
    RIFLE: {
      TYPE: 'rifle',
      DAMAGE: 25,
      MAX_AMMO: 30,
      MAX_RESERVE: 180, // 6 extra mags
      FIRE_RATE: 600, // rounds per minute
      RELOAD_TIME: 2500, // milliseconds
      ACCURACY: 0.9,
      RANGE: 350,
      HITSCAN: true,
      PROJECTILE_SPEED: 0 // instant
    },
    SMG: {
      TYPE: 'smg',
      DAMAGE: 20,
      MAX_AMMO: 35,
      MAX_RESERVE: 210, // 6 extra mags
      FIRE_RATE: 900,
      RELOAD_TIME: 2000,
      ACCURACY: 0.75,
      RANGE: 250,
      HITSCAN: true,
      PROJECTILE_SPEED: 0
    },
    SHOTGUN: {
      TYPE: 'shotgun',
      DAMAGE: 120, // Total damage for all pellets
      MAX_AMMO: 8,
      MAX_RESERVE: 32,
      FIRE_RATE: 70,
      RELOAD_TIME: 3500, // Shell-by-shell
      ACCURACY: 0.6,
      RANGE: 200,
      HITSCAN: true,
      PROJECTILE_SPEED: 0,
      PELLET_COUNT: 8,
      SPREAD_ANGLE: 0.15 // radians
    },
    BATTLERIFLE: {
      TYPE: 'battlerifle',
      DAMAGE: 35,
      MAX_AMMO: 20,
      MAX_RESERVE: 120, // 6 extra mags
      FIRE_RATE: 450,
      RELOAD_TIME: 2800,
      ACCURACY: 0.95,
      RANGE: 400,
      HITSCAN: true,
      PROJECTILE_SPEED: 0
    },
    SNIPERRIFLE: {
      TYPE: 'sniperrifle',
      DAMAGE: 90,
      MAX_AMMO: 5,
      MAX_RESERVE: 30, // 6 extra mags
      FIRE_RATE: 40,
      RELOAD_TIME: 3500,
      ACCURACY: 0.98,
      RANGE: 600,
      HITSCAN: true,
      PROJECTILE_SPEED: 0
    },
    
    // Secondary Weapons
    PISTOL: {
      TYPE: 'pistol',
      DAMAGE: 25,
      MAX_AMMO: 12,
      MAX_RESERVE: 72, // 6 extra mags
      FIRE_RATE: 450,
      RELOAD_TIME: 1500,
      ACCURACY: 0.8,
      RANGE: 200,
      HITSCAN: true,
      PROJECTILE_SPEED: 0
    },
    REVOLVER: {
      TYPE: 'revolver',
      DAMAGE: 60,
      MAX_AMMO: 6,
      MAX_RESERVE: 36, // 6 extra cylinders
      FIRE_RATE: 150,
      RELOAD_TIME: 3000,
      ACCURACY: 0.9,
      RANGE: 250,
      HITSCAN: true,
      PROJECTILE_SPEED: 0
    },
    SUPPRESSEDPISTOL: {
      TYPE: 'suppressedpistol',
      DAMAGE: 20,
      MAX_AMMO: 15,
      MAX_RESERVE: 90, // 6 extra mags
      FIRE_RATE: 450,
      RELOAD_TIME: 1800,
      ACCURACY: 0.85,
      RANGE: 150,
      HITSCAN: true,
      PROJECTILE_SPEED: 0
    },
    
    // Support Weapons
    GRENADELAUNCHER: {
      TYPE: 'grenadelauncher',
      DAMAGE: 100,
      MAX_AMMO: 6,
      MAX_RESERVE: 18, // 3 extra reloads
      FIRE_RATE: 60,
      RELOAD_TIME: 4000,
      ACCURACY: 0.9,
      RANGE: 300,
      HITSCAN: false,
      PROJECTILE_SPEED: 150,
      EXPLOSION_RADIUS: 40,
      ARC_GRAVITY: 300, // units/sec²
      FUSE_TIME: 3000 // 3 seconds
    },
    MACHINEGUN: {
      TYPE: 'machinegun',
      DAMAGE: 10,
      MAX_AMMO: 200,
      MAX_RESERVE: 600, // 3 extra belts
      FIRE_RATE: 1000,
      RELOAD_TIME: 8000,
      ACCURACY: 0.7,
      RANGE: 350,
      HITSCAN: true,
      PROJECTILE_SPEED: 0,
      HEAT_GAIN_PER_SHOT: 5,
      HEAT_COOLDOWN_RATE: 10, // per second
      OVERHEAT_THRESHOLD: 320,
      OVERHEAT_PENALTY_TIME: 3000 // milliseconds
    },
    ANTIMATERIALRIFLE: {
      TYPE: 'antimaterialrifle',
      DAMAGE: 250,
      MAX_AMMO: 5,
      MAX_RESERVE: 20, // 4 extra mags
      FIRE_RATE: 30,
      RELOAD_TIME: 4500,
      ACCURACY: 0.99,
      RANGE: 800,
      HITSCAN: true,
      PROJECTILE_SPEED: 0,
      MAX_PENETRATIONS: 3,
      PENETRATION_DAMAGE_LOSS: [0.2, 0.4, 0.6] // Damage loss per penetration
    },
    
    // Thrown Weapons
    GRENADE: {
      TYPE: 'grenade',
      DAMAGE: 200,
      MAX_AMMO: 2,
      MAX_RESERVE: 2, // Total count
      FIRE_RATE: 60,
      RELOAD_TIME: 1000,
      ACCURACY: 1.0,
      RANGE: 150,
      HITSCAN: false,
      PROJECTILE_SPEED: 200,
      BASE_THROW_SPEED: 12,
      CHARGE_SPEED_BONUS: 18,
      EXPLOSION_RADIUS: 40,
      CHARGE_LEVELS: 5,
      CHARGE_MULTIPLIER: 1.5,
      FUSE_TIME: 3000 // milliseconds
    },
    SMOKEGRENADE: {
      TYPE: 'smokegrenade',
      DAMAGE: 0,
      MAX_AMMO: 2,
      MAX_RESERVE: 2,
      FIRE_RATE: 60,
      RELOAD_TIME: 1000,
      ACCURACY: 1.0,
      RANGE: 150,
      HITSCAN: false,
      PROJECTILE_SPEED: 180,
      SMOKE_RADIUS: 60,
      SMOKE_DURATION: 10000, // 10 seconds
      FUSE_TIME: 2000 // milliseconds
    },
    FLASHBANG: {
      TYPE: 'flashbang',
      DAMAGE: 0,
      MAX_AMMO: 2,
      MAX_RESERVE: 2,
      FIRE_RATE: 60,
      RELOAD_TIME: 1000,
      ACCURACY: 1.0,
      RANGE: 150,
      HITSCAN: false,
      PROJECTILE_SPEED: 200,
      EFFECT_RADIUS: 100,
      MAX_EFFECT_DURATION: 2000, // 2 seconds at full intensity
      FUSE_TIME: 1500 // milliseconds
    },
    ROCKET: {
      TYPE: 'rocket',
      DAMAGE: 200,
      FIRE_RATE: 30,
      RELOAD_TIME: 3000,
      MAX_AMMO: 1,
      MAX_RESERVE: 5,
      ACCURACY: 0.95,
      RANGE: 400,
      HITSCAN: false,
      PROJECTILE_SPEED: 200,
      EXPLOSION_RADIUS: 50
    }
  },
  
  // Destruction system
  DESTRUCTION: {
    WALL_SLICES: 5,
    SLICE_HEALTH: 100,
    MATERIAL_MULTIPLIERS: {
      CONCRETE: 6.75, // Increased by 350% from 1.5 (1.5 + 1.5*3.5 = 6.75)
      WOOD: 0.8,
      METAL: 2.0,
      GLASS: 0.3
    },
    SOFT_WALL_PENETRATION_DAMAGE: 15 // Damage absorbed when penetrating soft walls
  },
  
  // Combat system
  COMBAT: {
    DAMAGE_FALLOFF_START: 0.7, // 70% of weapon range
    DAMAGE_FALLOFF_MIN: 0.3, // minimum 30% damage
    HEADSHOT_MULTIPLIER: 2.0,
    ADS_ACCURACY_BONUS: 0.2,
    MOVEMENT_ACCURACY_PENALTY: 0.3,
    EXPLOSION_FALLOFF_POWER: 2.0,
    
    // Shotgun damage falloff
    SHOTGUN_FALLOFF_RANGES: [10, 20, 30], // meters
    SHOTGUN_FALLOFF_MULTIPLIERS: [1.0, 0.5, 0.25]
  },
  
  // Weapon loadout system
  LOADOUT: {
    MAX_SUPPORT_SLOTS: 3,
    WEAPON_SLOT_COSTS: {
      grenade: 1,
      smokegrenade: 1,
      flashbang: 1,
      grenadelauncher: 2,
      rocket: 2,  // Changed from 3 to 2
      machinegun: 3,  // Changed from 2 to 3
      antimaterialrifle: 3  // Changed from 2 to 3
    }
  }
} as const;

export const EVENTS = {
  PLAYER_INPUT: 'player:input',
  PLAYER_SHOOT: 'player:shoot',
  PLAYER_RELOAD: 'player:reload',
  GAME_STATE: 'game:state',
  PLAYER_JOINED: 'player:joined',
  PLAYER_LEFT: 'player:left',
  WALL_DAMAGED: 'wall:damaged',
  PROJECTILE_FIRED: 'projectile:fired',
  PROJECTILE_HIT: 'projectile:hit',
  SOUND_PLAY: 'sound:play',
  SOUND_STOP: 'sound:stop',
  
  // Extended weapon events
  WEAPON_FIRE: 'weapon:fire',
  WEAPON_FIRED: 'weapon:fired', // confirmation
  WEAPON_HIT: 'weapon:hit',
  WEAPON_MISS: 'weapon:miss',
  WEAPON_RELOAD: 'weapon:reload',
  WEAPON_RELOADED: 'weapon:reloaded',
  WEAPON_SWITCH: 'weapon:switch',
  WEAPON_SWITCHED: 'weapon:switched',
  GRENADE_THROW: 'grenade:throw',
  GRENADE_THROWN: 'grenade:thrown',
  GRENADE_EXPLODED: 'grenade:exploded',
  PLAYER_DAMAGED: 'player:damaged',
  PLAYER_KILLED: 'player:killed',
  WALL_DESTROYED: 'wall:destroyed',
  PROJECTILE_CREATED: 'projectile:created',
  PROJECTILE_UPDATED: 'projectile:updated',
  PROJECTILE_EXPLODED: 'projectile:exploded',
  PROJECTILE_DESTROYED: 'projectile:destroyed',
  EXPLOSION_CREATED: 'explosion:created',
  
  // New weapon events
  WEAPON_HEAT_UPDATE: 'weapon:heat:update',
  SMOKE_DEPLOYED: 'backend:smoke:deployed',
  FLASHBANG_DETONATED: 'backend:flashbang:detonated',
  WALL_PENETRATED: 'backend:wall:penetrated'
} as const;
