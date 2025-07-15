# Feature Specification & Implementation Dependencies

This document outlines all core features planned for the **Destructible 2D Multiplayer Shooter**, organized in recommended implementation order. Each feature includes required systems, architectural dependencies, and development priorities.

---

## 1. **Player Movement System**
### Features
- Slow walking (silent, slowest)
- Walking (moderate speed, moderate noise)
- Running (fastest, loudest, forward-only)

### Requirements
- **Input Handling Module:** Captures key states (Ctrl, Shift).
- **Movement States:** Controls speed, noise radius.
- **Noise Emission System:** Quantifies noise produced per movement type.
- **Server Synchronization:** Player position, movement state synced.

**Priority:** Implement early (Day 1-2). Foundational for all other systems.

---

## 2. **Basic Multiplayer Networking**
### Features
- Real-time player movement sync
- Input event broadcasting
- State reconciliation

### Requirements
- **Socket.io Integration:** Client-server communication.
- **Server Authority Model:** Server resolves final positions.
- **Client Prediction:** Smooth perceived movement.

**Priority:** Early implementation (Day 1-2). Required before combat, vision, or sound features.

---

## 3. **Camera & Field of View System**
### Features
- Directional fog of war
- Dynamic vision cone based on player's facing
- Mouse-based camera look extension

### Requirements
- **Camera Controller:** Mouse input for vision extension.
- **Fog of War Rendering:** Shaders or masking layers.
- **Vision Calculations:** Dynamic based on FOV and environment.

**Dependencies:** Requires basic movement & networking.

**Priority:** Mid-priority (Day 3-5), after movement and shooting foundation.

---

## 4. **Shooting System**
### Features
- Hip fire and aim-down-sights (ADS)
- Weapon-specific accuracy and behavior
- Movement penalties (cannot ADS while running)
- Penetration mechanics through destructible walls

### Requirements
- **Weapon Controller:** Switching between hip fire and ADS.
- **Accuracy Modifier:** Adjusts spread based on state.
- **Server-side Hit Detection:** Ensures fair shooting results.
- **Projectile System:** Supports different ammo types and physics.

**Dependencies:** Requires movement, camera direction for accuracy.

**Priority:** Core implementation (Day 3-4).

---

## 5. **Destructible Environment System**
### Features
- Walls, props with health states
- Vertical slice damage model (granular destruction)
- Visual degradation of assets
- Explosive propagation (shrapnel, adjacent damage)

### Requirements
- **Tilemap System:** Supports dynamic tile updates.
- **Tile HP Management:** Per-slice damage tracking.
- **Server Sync:** Authoritative destruction state.
- **Rendering Updates:** Change tiles visually as damage accumulates.

**Dependencies:** Shooting system for impact, networking for sync.

**Priority:** Implement alongside shooting mechanics.

---

## 6. **Sound System**
### Features
- Spatial sound with occlusion
- Volume attenuation based on distance and walls
- Differentiated sounds (footsteps, gunfire, explosions)
- Footstep noise varies by movement speed
- Silencers reduce sound emission radius

### Requirements
- **Audio Engine:** Supports positional audio.
- **Noise Propagation System:** Factors in walls, distance.
- **Sound Library:** Gunfire, footsteps, ambient sounds.
- **Headphone Spatial Audio Support:** For directional cues.

**Dependencies:** Movement system, shooting, destructibility.

**Priority:** After shooting & destructibility (Day 5-6).

---

## 7. **Grenades & Explosives System**
### Features
- Throwable grenades (bounce physics)
- Charge mechanic for throw distance
- Explosives cause destructibility and damage
- Shrapnel effect on walls

### Requirements
- **Grenade Physics System:** Bouncing, arcing projectiles.
- **Explosion Logic:** Damage area and propagation.
- **Tile & Player Impact:** Simultaneous environmental and player damage.

**Dependencies:** Shooting, destructibility.

**Priority:** Mid-late development (Day 5-6).

---

## 8. **Weapon Stats & Customization**
### Stats per Weapon
- Damage (integer)
- Accuracy (float, spread in degrees)
- Fire rate (integer)
- Reload time (integer)
- Movement speed debuff (%)
- Destructiveness (map damage potential)
- Magazine size (integer)
- Ammo reserve (integer)
- Penetration (%)

### Requirements
- **Weapon Data Schema:** Define attributes for each weapon.
- **Weapon Switching System:** Primary, secondary, support slots.
- **Inventory UI:** For pre-match loadout selection.

**Dependencies:** Shooting, player state system.

**Priority:** Concurrent with shooting development.

---

## 9. **Map & Environmental Design**
### Features
- Grim warehouse aesthetic: concrete, drywall, props
- Destructible vs indestructible walls
- Visual damage states for props/walls
- Dynamic lighting & shadow casting
- Borders are fully indestructible

### Requirements
- **Map Editor/Format:** Bespoke handcrafted maps.
- **Tile Metadata:** Marks destructible, soft/hard, indestructible.
- **Light Source Placement:** For shadow effects.

**Dependencies:** Destructibility, fog of war.

**Priority:** Initial map needed by mid-development for testing.

---

## 10. **Player Class System & Loadouts**
### Features
- Primary, secondary, and support item slots
- Larger support items (rocket launchers) consume more slots
- Reserve ammo management
- Restrictions on switching weapons during match

### Requirements
- **Inventory & Loadout System:** Manages equipment slots.
- **Player State Tracking:** Tracks held weapons, ammo counts.
- **UI for Loadout Selection:** Pre-game setup.

**Dependencies:** Weapon stats system.

**Priority:** Late development phase (Day 6-7).

---

## Final Implementation Sequence
| Feature                       | Start Day |
|-------------------------------|-----------|
| Player Movement              | Day 1      |
| Basic Multiplayer Networking | Day 1      |
| Camera & Field of View       | Day 3      |
| Shooting System              | Day 3      |
| Destructible Environments    | Day 3-4    |
| Sound System                 | Day 5      |
| Grenades & Explosives        | Day 5      |
| Weapon Stats & Customization | Day 4-5    |
| Map & Environmental Design   | Day 4-5    |
| Player Class & Loadouts      | Day 6-7    |

---

> This feature document ensures an organized, dependency-aware development process aligned with your overall roadmap.

