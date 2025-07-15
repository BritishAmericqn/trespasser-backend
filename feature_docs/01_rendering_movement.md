# Feature Documentation: Top-Down 2D Rendering & Movement System

> **UPDATE FOR 1v1-4v4**: With only 8 players max and 480x270 pixel art resolution, this system becomes trivial to implement with guaranteed performance. All three movement speeds are easily achievable.

## Overview
The rendering and movement system forms the foundation of player interaction. This system must be designed to handle smooth, responsive player control while maintaining synchronization across networked clients.

## Core Concepts

### Coordinate System Architecture
- **World Space vs Screen Space**: Maintain clear separation between game world coordinates and display coordinates
- **Fixed Unit System**: Establish a consistent unit measurement (e.g., 1 unit = 32 pixels) early and maintain throughout
- **Origin Point**: Top-down games typically use top-left origin, but consider center-origin for easier calculations

### Movement Models

#### Velocity-Based Movement
- **Advantages**: Smooth acceleration/deceleration, easier physics integration, more realistic feel
- **Considerations**: Requires delta-time calculations, more complex for networking
- **Use When**: You want momentum, sliding, or physics-based interactions

#### Direct Position Movement
- **Advantages**: Simpler networking, immediate response, easier to debug
- **Considerations**: Can feel "digital" or less smooth
- **Use When**: Precision is more important than smoothness

### Rendering Pipeline Considerations

#### Layer Management Strategy
1. **Background Layer**: Static terrain, floors
2. **Destructible Layer**: Walls, props that can be destroyed
3. **Entity Layer**: Players, projectiles, items
4. **Effect Layer**: Explosions, particles
5. **UI/Fog Layer**: Vision system, HUD elements

**Critical Decision**: Order these layers at initialization and maintain consistency. Changing layer order mid-development is painful.

## Common Pitfalls & Solutions

### Pitfall 1: Floating Point Precision Issues
- **Problem**: Accumulating small errors in position calculations
- **Solution**: Round positions to fixed decimal places, use integer-based grid system for authoritative positions
- **Impact**: Prevents desync between clients over time

### Pitfall 2: Frame-Rate Dependent Movement
- **Problem**: Players on high-refresh monitors move faster
- **Solution**: Always use delta-time in movement calculations
- **Industry Standard**: Fixed timestep for physics, interpolated rendering

### Pitfall 3: Input Lag vs Responsiveness
- **Problem**: Waiting for server confirmation creates sluggish feel
- **Solution**: Client-side prediction with server reconciliation
- **Trade-off**: More complex but essential for good game feel

## System Interconnections

### Connects TO:
1. **Networking System**
   - Sends: Position updates, velocity changes, input states
   - Frequency: Consider update rates (10-30Hz typical)
   - Optimization: Only send on significant change

2. **Collision System**
   - Provides: Current position, movement vector
   - Receives: Collision responses, valid positions
   - Critical: Movement must respect collision boundaries

3. **Vision/Fog System**
   - Triggers: Vision updates on position change
   - Optimization: Only recalculate when crossing tile boundaries

### Receives FROM:
1. **Input System**
   - Raw input commands (WASD, controller input)
   - Must handle multiple simultaneous inputs
   - Consider input buffering for better feel

2. **Networking System**
   - Authoritative position corrections
   - Other player positions for interpolation
   - Timestamp data for lag compensation

## Scalability Considerations

### Performance Scaling
- **Culling Strategy**: Only render entities within extended viewport
- **LOD System**: Simplified rendering for distant objects
- **Batch Rendering**: Group similar sprites to reduce draw calls

### Feature Scaling
- **Movement Types**: Design system to easily add dash, teleport, vehicles
- **Player Count**: Optimize for expected max (8-16 players)
- **Map Size**: Consider streaming/chunking for large maps

## Key Decisions to Make Early

1. **Grid-Based vs Free Movement**
   - Grid: Easier collision, simpler networking, tactical feel
   - Free: More fluid, complex collision, action feel

2. **Client Authority Level**
   - Full Server: Most secure, highest latency
   - Client Predictive: Best feel, moderate complexity
   - Client Authoritative: Easiest, vulnerable to cheating

3. **Interpolation Strategy**
   - Linear: Simple, can look robotic
   - Cubic: Smoother, more CPU intensive
   - Predictive: Best for competitive play

## Research Findings

### Industry Standards
- **Update Rate**: 60-120 FPS rendering, 10-30 Hz network updates
- **Input Polling**: Every frame for responsiveness
- **Position Precision**: 2-3 decimal places sufficient

### Proven Architectures
1. **Entity-Component-System (ECS)**: Highly scalable, complex initially
2. **Object-Oriented**: Familiar, can become tangled
3. **Hybrid**: Game objects with component behaviors

## Implementation Order
1. Basic position and velocity components
2. Input handling system
3. Delta-time based movement
4. Collision detection integration
5. Network prediction/reconciliation
6. Optimization and culling

## Testing Considerations
- Test with artificial latency (100-300ms)
- Verify movement at different frame rates
- Check edge cases (corners, simultaneous inputs)
- Stress test with maximum players

## Future-Proofing
- Abstract movement logic from rendering
- Use interfaces for different movement types
- Keep physics calculations separate
- Design for both keyboard and controller input

## References for Deep Dives
- Gabriel Gambetta's Client-Server Game Architecture series
- Valve's Source Engine networking documentation
- GDC talks on networked physics
- Glenn Fiedler's networking articles

---
*This document should be referenced when implementing the movement system and when designing systems that interact with player position or rendering.* 