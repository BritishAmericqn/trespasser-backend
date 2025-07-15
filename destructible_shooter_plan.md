# Destructible 2D Multiplayer Shooter - Master Design & Development Document

## Project Overview

**Title:** Destructible 2D Top-Down Multiplayer Shooter\
**Core Mechanics:**

- Real-time multiplayer
- Dynamic destructible environments
- Fog of war / vision limitation system
- Distinct weapon types affecting terrain and players

**Tech Stack:**

- **Frontend:** Phaser 3 (JavaScript)
- **Networking:** Socket.io (WebSocket-based)
- **Backend:** Node.js server (authoritative game state)
- **Version Control:** GitHub
- **AI Tools:**
  - **Cursor AI:** Code generation, refactoring, debugging
  - **ChatGPT:** Research, architecture planning, debugging strategies
  - **Asset Generation:** MidJourney, DALL-E, Soundraw, Boomy, ElevenLabs

---

## Workflow & Tooling Strategy

### Core Tools

- **Cursor AI:** Continuous AI-assistance within your codebase.
- **ChatGPT Plus:** Research, architectural guidance.
- **GitHub:** Project management, source control, branch strategy.

### Best Practices

- **Branching:** Feature-specific branches (e.g., `feature/destruction-sync`).
- **Commits:** Daily, meaningful commits with clear messages.
- **Documentation:** Maintain markdown files for architecture, decisions, and learnings.
- **AI Utilization:**
  - Use AI for code scaffolding but rigorously test outputs.
  - Employ ChatGPT for debugging plans, performance tuning.

### Pitfalls to Avoid

- Over-relying on AI code without deep validation.
- Unoptimized network messages leading to latency spikes.
- Art and sound style inconsistency from mixed AI outputs.

---

## Core Features & Implementations

### 1. Top-Down 2D Rendering & Movement

- **Framework:** Phaser 3
- **Features:**
  - Smooth player movement with velocity.
  - Collision detection with walls and props.
  - Pixel-perfect rendering on tilemaps.

### 2. Multiplayer Networking

- **Networking:** Socket.io on top of Node.js.
- **Approach:**
  - Server-authoritative model.
  - Client prediction for movement.
  - State reconciliation to correct desync.
  - Event types:
    - `player_move`
    - `shoot_bullet`
    - `damage_tile`
    - `destroy_tile`
    - `player_disconnect`

### 3. Fog of War / Vision

- **Behavior:**
  - Player vision limited similar to Among Us.
  - Visibility updates dynamically based on movement and wall destruction.
- **Implementation:**
  - Phaser's lighting plugins, custom shaders, or rendering masks.
  - Update fog layer only on state change (move, destruction).
- **Networking:**
  - Primarily client-side but can validate against server states.

### 4. Destructible Environments

- **Mechanics:**
  - Walls/props have health and degrade over time.
  - Visual state changes as damage is dealt.
  - Distinction between breakable and unbreakable elements.
- **Implementation:**
  - Phaser Dynamic Tilemap Layers for state changes.
  - Server maintains HP for each tile, syncs to clients.
- **Optimizations:**
  - Broadcast destruction events only when thresholds are crossed.
  - Employ delta updates for network efficiency.

### 5. Weapons & Damage Types

- **Standard Bullets:** Moderate damage, quick firing.
- **Rockets/Explosives:** High damage, break sturdier walls.
- **Damage System:** Different coefficients for materials and weapons.

### 6. Map Design

- **Phase 1:** Bespoke handcrafted maps.
  - Control player flow, chokepoints.
  - Carefully balance destructibility and visibility.
- **Phase 2 (Future):** Procedural generation.
  - Seed-based layout creation.
  - AI-assisted balancing and validation.

---

## Performance & Optimization

- **Latency Mitigation:**
  - Efficient event handling.
  - Client-side prediction.
  - Interpolation and smoothing for player movements.
- **Rendering Efficiency:**
  - Update fog of war only on necessary triggers.
  - Precompute vision cones where feasible.
- **Stress Testing:**
  - Test concurrency with 4-8 players.
  - Profile FPS and network throughput.

---

## Asset Pipeline with AI

- **Art Generation:**
  - Wall, floor textures: MidJourney, DALL-E.
  - Props/UI elements: MidJourney.
- **Sound & Music:**
  - Weapons, explosions: ElevenLabs, Freesound.
  - Background music: Soundraw, Boomy.
- **Best Practices:**
  - Generate assets in consistent batches.
  - Use AI placeholders, refine or replace before production.

---

## Project Architecture

```plaintext
Frontend (Phaser 3 + Socket.io client)
│
├── Player Input Handling
├── Visual Rendering (Tilemaps, Sprites, Fog of War)
├── Audio & UI Feedback
└── Send Inputs -> Backend

Backend (Node.js + Socket.io)
│
├── Player State Management
├── Tile Destruction Tracking
├── Vision Data (Optional)
├── Weapon Effect Resolution
└── Broadcast Authoritative Updates to Clients
```

---

## Development Roadmap

### Day 1-2: Research & Foundations

- Master Phaser 3 fundamentals.
- Implement basic player movement.
- Establish Socket.io connections and sync player positions.

### Day 3-4: Core Gameplay Mechanics

- Implement destructible tilemaps.
- Sync destruction states across network.
- Develop basic shooting mechanics.

### Day 5: Vision & Fog of War

- Implement fog of war with dynamic vision updates.
- Optimize rendering and sync with wall destruction.

### Day 6: Polish & Feedback

- Add sound effects, music, and UI elements.
- Implement basic scoring/win conditions.
- Conduct playtests, gather feedback.

### Day 7: Optimization & Delivery

- Bug fixes and performance improvements.
- Stress test multiplayer sessions.
- Finalize for demo and documentation.

---

## Summary of Strategic Choices

- **Chosen Stack:** Phaser 3 + Socket.io + Node.js.
- **Manual maps first** to ensure balance.
- **AI leveraged for:** Code scaffolding, assets, sound.
- **Key Success Factors:** Efficient networking, polished core loop, optimized rendering.

---

## Next Actions

- Finalize and initialize project repo.
- Generate first-pass AI assets.
- Start with player movement and networking demo.
- Track learnings and architectural decisions per day.

---

> **Note:** This document is the cornerstone for the entire project. It should evolve as features are developed, challenges are encountered, and new optimizations are discovered.

