# Feature Documentation: Fog of War / Vision System

> **UPDATE FOR 1v1-4v4**: At 480x270 pixel art resolution with only 8 players, all complex vision features become feasible. Narrow FOV through holes, mouse-controlled vision, and dynamic updates are all performant using scanline algorithms on the pixel grid.

## Overview
The vision system creates tactical depth by limiting player information. It must balance performance with visual quality while preventing cheating and maintaining synchronized state across clients. This system fundamentally changes how players approach the game.

## Core Vision Models

### Line of Sight (LOS) System
**Hard Shadow Model**
- Binary visible/not visible states
- Sharp shadow edges
- Easier to implement and understand
- Can feel less atmospheric

**Soft Shadow Model**
- Gradient visibility (full → partial → none)
- More realistic and atmospheric
- Higher computational cost
- Better for horror/stealth elements

### Vision Calculation Methods

#### Raycasting Approach
- Cast rays from player to points
- **Pros**: Accurate, intuitive
- **Cons**: Computationally expensive
- **Optimization**: Limit ray count, cache results

#### Shadow Casting
- Calculate shadows from obstacles
- **Pros**: Efficient for many obstacles
- **Cons**: Complex implementation
- **Best for**: Dense environments

#### Tile-Based Visibility
- Pre-calculate visibility per tile
- **Pros**: Very fast lookups
- **Cons**: Less precise, memory usage
- **Best for**: Grid-based games

## Common Pitfalls & Solutions

### Pitfall 1: Performance Degradation
- **Problem**: Recalculating vision every frame
- **Solution**: 
  - Only recalculate on position change
  - Use visibility caching
  - Implement dirty flagging system
  - Consider lower update rates for vision

### Pitfall 2: Wallhack Vulnerabilities
- **Problem**: Client can modify code to see through walls
- **Solution**:
  - Server-side vision validation
  - Only send visible entity data
  - Implement view distance limits
  - Add anti-cheat detection

### Pitfall 3: Edge Case Visibility
- **Problem**: Partial visibility through corners
- **Solution**:
  - Define clear visibility rules
  - Use center-point checks
  - Implement visibility percentage thresholds

### Pitfall 4: Dynamic Environment Sync
- **Problem**: Vision doesn't update with destruction
- **Solution**:
  - Link destruction events to vision updates
  - Implement visibility graph that updates
  - Cache only static elements

## System Interconnections

### Connects TO:

1. **Rendering System**
   - Provides: Visibility mask/shader data
   - Controls: What gets rendered
   - Critical: Must be fast enough for 60+ FPS

2. **Networking System**
   - Filters: Which entities to send to each client
   - Security: Prevents sending non-visible data
   - Optimization: Reduces bandwidth significantly

3. **Destruction System**
   - Listens: Wall destruction events
   - Updates: Vision graph when terrain changes
   - Challenge: Efficient recalculation

4. **Audio System**
   - Filters: Sounds from non-visible sources
   - Feature: Muffled sounds through walls
   - Design: Audio cues for unseen dangers

### Receives FROM:

1. **Movement System**
   - Player positions for vision origin
   - Movement deltas for update triggers
   - Facing direction (if directional vision)

2. **Map System**
   - Static obstacle data
   - Material properties (transparent/opaque)
   - Pre-computed visibility regions

3. **Destruction System**
   - Obstacle removal notifications
   - New opening creation events
   - Partial destruction states

## Architecture Patterns

### Visibility Graph
**Structure**: Network of visibility connections
- Nodes: Key positions (corners, doorways)
- Edges: Direct visibility between nodes
- Updates: When environment changes
- Usage: Quickly determine potential visibility

### Layered Visibility
1. **Static Layer**: Pre-computed base visibility
2. **Dynamic Layer**: Destructible walls, doors
3. **Entity Layer**: Other players, objects
4. **Effect Layer**: Smoke, darkness modifiers

### Update Strategies

#### Immediate Update
- Vision updates instantly with movement
- Best for: Competitive games
- Cost: Higher CPU usage

#### Interpolated Update
- Smooth transition between vision states
- Best for: Atmospheric games
- Benefit: Hides network latency

#### Stepped Update
- Vision updates at fixed intervals
- Best for: Performance-constrained
- Trade-off: Slightly delayed reactions

## Performance Optimizations

### Spatial Optimizations
- **Hierarchical Visibility**: Quadtree/octree culling
- **Portal System**: Room-based visibility
- **Distance Culling**: Maximum view range
- **LOD System**: Reduced detail at edges

### Calculation Optimizations
- **Batch Processing**: Update multiple players together
- **Async Calculation**: Spread over multiple frames
- **GPU Acceleration**: Shader-based visibility
- **Caching Strategy**: Store recent results

### Memory Optimizations
- **Bit Fields**: Compact visibility storage
- **Compression**: RLE for visibility masks
- **Pooling**: Reuse visibility buffers
- **Streaming**: Load visibility data as needed

## Visual Design Considerations

### Fog Rendering Techniques

#### Hard Edge Fog
- Clear visible/invisible boundary
- Easier to implement
- More "gamey" feel
- Better performance

#### Gradient Fog
- Smooth transition
- More realistic
- Requires shader work
- Higher GPU cost

#### Volumetric Fog
- 3D fog effects
- Most realistic
- Significant performance cost
- Best for atmosphere

### Visual Feedback
- **Edge Highlighting**: Show vision boundaries
- **Minimap Integration**: Fog on tactical view
- **Discovery Effects**: Reveal animations
- **Threat Indicators**: Sounds from fog

## Security Considerations

### Anti-Cheat Measures
1. **Server Validation**: Never trust client vision
2. **Delayed Information**: Buffer entity positions
3. **Statistical Detection**: Track impossible knowledge
4. **Honeypot Entities**: Invisible bait objects

### Network Security
- Only send data for visible entities
- Implement vision-based interest management
- Add random validation checks
- Log suspicious vision patterns

## Implementation Stages

### Phase 1: Basic Visibility
- Simple radius-based vision
- Binary visible/invisible states
- Client-side only rendering

### Phase 2: Obstacle Integration
- Line of sight blocking
- Static obstacle support
- Basic shadow casting

### Phase 3: Dynamic Updates
- Destruction integration
- Optimized recalculation
- Network filtering

### Phase 4: Polish & Effects
- Smooth transitions
- Visual effects
- Performance optimization
- Security hardening

## Testing Strategies

### Functional Testing
- Vision through corners
- Destruction sight lines
- Multiple player overlaps
- Edge case positions

### Performance Testing
- Maximum players in view
- Rapid movement stress
- Destruction cascade effects
- Frame rate monitoring

### Security Testing
- Modified client detection
- Information leak checks
- Replay validation
- Statistical analysis

## Design Decisions

### Vision Shape
- **Circular**: Natural, no orientation needed
- **Cone**: Directional, more tactical
- **Square**: Easier calculations, less natural

### Update Frequency
- **Every Frame**: Smoothest, expensive
- **Fixed Rate**: Predictable performance
- **On Change**: Most efficient

### Visibility States
- **Binary**: Simple, clear
- **Percentage**: More information, complex
- **Multi-level**: Compromise solution

## Industry Examples

### Among Us
- Simple circular vision
- Binary visibility
- Shared vision areas
- Perfect for social deduction

### League of Legends
- Fog of war + bush mechanics
- Team shared vision
- Ward system for vision control
- Strategic vision gameplay

### Counter-Strike
- No fog of war
- Audio cues instead
- Smoke grenades for temporary vision blocking
- Different design philosophy

## Future Considerations

### Advanced Features
- Team vision sharing options
- Vision-granting abilities
- Temporary vision blocks (smoke)
- Vision recording/replay
- Different vision ranges per player
- Night/day vision cycles

### Technical Evolution
- Ray tracing support
- AI-driven occlusion
- Predictive pre-calculation
- Cloud-based vision compute

## Integration Checklist
- [ ] Define vision model (LOS, radius, etc.)
- [ ] Choose calculation method
- [ ] Design update strategy
- [ ] Plan network integration
- [ ] Consider security measures
- [ ] Design visual representation
- [ ] Plan performance budget
- [ ] Test edge cases

---
*This document should be referenced when implementing the vision system and when designing features that interact with player visibility or fog of war mechanics.* 