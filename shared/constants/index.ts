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
    RIFLE: {
      TYPE: 'rifle',
      DAMAGE: 25,
      MAX_AMMO: 30,
      MAX_RESERVE: 90,
      FIRE_RATE: 600, // rounds per minute
      RELOAD_TIME: 2000, // milliseconds
      ACCURACY: 0.9,
      RANGE: 300,
      HITSCAN: true,
      PROJECTILE_SPEED: 0 // instant
    },
    PISTOL: {
      TYPE: 'pistol',
      DAMAGE: 35,
      MAX_AMMO: 12,
      MAX_RESERVE: 60,
      FIRE_RATE: 300,
      RELOAD_TIME: 1500,
      ACCURACY: 0.8,
      RANGE: 200,
      HITSCAN: true,
      PROJECTILE_SPEED: 0
    },
    GRENADE: {
      TYPE: 'grenade',
      DAMAGE: 100,
      MAX_AMMO: 1,
      MAX_RESERVE: 3,
      FIRE_RATE: 60,
      RELOAD_TIME: 1000,
      ACCURACY: 1.0,
      RANGE: 150, // Increased back to support faster speeds
      HITSCAN: false,
      PROJECTILE_SPEED: 200, // Legacy - not used with new system
      BASE_THROW_SPEED: 12,  // Base speed for 24 px/s at charge 1
      CHARGE_SPEED_BONUS: 18, // Results in 24-96 px/s range
      EXPLOSION_RADIUS: 40,
      CHARGE_LEVELS: 5,
      CHARGE_MULTIPLIER: 1.5
    },
    ROCKET: {
      TYPE: 'rocket',
      DAMAGE: 100,
      FIRE_RATE: 60, // 1 per second
      RELOAD_TIME: 3000,
      MAX_AMMO: 1,
      MAX_RESERVE: 10,
      ACCURACY: 0.95,
      RANGE: 400,
      HITSCAN: false,
      PROJECTILE_SPEED: 200,  // Reduced from 300 for better collision detection
      EXPLOSION_RADIUS: 50
    }
  },
  
  // Destruction system
  DESTRUCTION: {
    WALL_SLICES: 5,
    SLICE_HEALTH: 100,
    MATERIAL_MULTIPLIERS: {
      CONCRETE: 1.5,
      WOOD: 0.8,
      METAL: 2.0,
      GLASS: 0.3
    }
  },
  
  // Combat system
  COMBAT: {
    DAMAGE_FALLOFF_START: 0.7, // 70% of weapon range
    DAMAGE_FALLOFF_MIN: 0.3, // minimum 30% damage
    HEADSHOT_MULTIPLIER: 2.0,
    ADS_ACCURACY_BONUS: 0.2,
    MOVEMENT_ACCURACY_PENALTY: 0.3,
    EXPLOSION_FALLOFF_POWER: 2.0
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
  EXPLOSION_CREATED: 'explosion:created'
} as const;
