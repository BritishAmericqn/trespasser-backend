# Feature Documentation: Weapons & Damage System

## Overview
The weapons system defines combat mechanics and player interactions. It must balance gameplay, provide satisfying feedback, handle network synchronization, and integrate with destruction, movement, and visual systems while maintaining fairness across different network conditions.

## Core Weapon Architecture

### Weapon Categories

#### Projectile-Based Weapons
**Bullets/Ballistics**
- Travel time and drop
- Penetration mechanics
- Ricochet possibilities
- **Pros**: Realistic, skill-based
- **Cons**: Complex networking, lag compensation

**Instant-Hit (Hitscan)**
- Immediate impact
- Simpler networking
- **Pros**: Responsive, predictable
- **Cons**: Less realistic, harder to balance

**Explosive Projectiles**
- Area of effect damage
- Environmental destruction
- **Pros**: Tactical options, spectacular
- **Cons**: Performance impact, balance challenges

### Damage Models

#### Direct Damage System
```
Damage Calculation:
- Base Weapon Damage
- × Distance Falloff Modifier
- × Material Penetration Modifier
- × Hit Location Modifier (if applicable)
- - Target Damage Resistance
= Final Damage Applied
```

#### Area Effect Damage
```
Explosion Damage:
- Center Point: 100% damage
- Linear/Exponential Falloff
- Obstacle Occlusion Check
- Multiple Target Handling
- Environmental Damage
```

## Common Pitfalls & Solutions

### Pitfall 1: Hit Registration Issues
- **Problem**: "I hit them!" but no damage
- **Solution**:
  - Client-side hit markers
  - Server validation with lag compensation
  - Visual feedback regardless of confirmation
  - Hit rejection explanation

### Pitfall 2: Weapon Imbalance
- **Problem**: One weapon dominates meta
- **Solution**:
  - Rock-paper-scissors design
  - Situational advantages
  - Resource/ammo limitations
  - Regular balance patches

### Pitfall 3: Network Advantage/Disadvantage
- **Problem**: High ping players have advantage/disadvantage
- **Solution**:
  - Lag compensation systems
  - Favor the shooter (within limits)
  - Maximum compensation threshold
  - Fair play boundaries

### Pitfall 4: Damage Feedback Clarity
- **Problem**: Players don't understand damage dealt/received
- **Solution**:
  - Clear visual indicators
  - Damage numbers (optional)
  - Audio feedback variation
  - Hit marker differentiation

## System Interconnections

### Connects TO:

1. **Physics System**
   - Provides: Projectile trajectories
   - Requests: Collision detection
   - Handles: Bullet penetration
   - Critical: Frame-independent physics

2. **Destruction System**
   - Sends: Damage events to environment
   - Specifies: Damage type and amount
   - Handles: Blast radius calculations
   - Creates: Destruction patterns

3. **Networking System**
   - Sends: Shot fired events
   - Receives: Hit confirmations
   - Handles: Lag compensation
   - Priority: High for combat events

4. **Visual Effects System**
   - Triggers: Muzzle flashes
   - Creates: Bullet tracers
   - Spawns: Impact effects
   - Manages: Explosion visuals

5. **Audio System**
   - Plays: Weapon sounds
   - Varies: By distance and environment
   - Triggers: Impact sounds
   - Manages: 3D positioning

6. **Player Health System**
   - Applies: Damage to targets
   - Checks: Armor/shields
   - Triggers: Death/respawn
   - Updates: Health UI

### Receives FROM:

1. **Input System**
   - Fire commands
   - Aim direction
   - Weapon switching
   - Reload requests

2. **Inventory System**
   - Current weapon
   - Ammo count
   - Weapon modifications
   - Available weapons

3. **Movement System**
   - Player velocity (for projectile inheritance)
   - Stance (affects accuracy)
   - Movement state

## Architecture Patterns

### Weapon State Machine
```
States:
- Idle → Ready to fire
- Firing → Shooting animation/logic
- Reloading → Cannot fire
- Switching → Changing weapons
- Jammed/Overheated → Temporary disable
```

### Projectile Management

#### Object Pooling
- Pre-allocate projectile objects
- Reuse instead of create/destroy
- Separate pools per projectile type
- Critical for performance

#### Trajectory Calculation
1. **Predictive**: Calculate full path upfront
2. **Iterative**: Step-by-step simulation
3. **Hybrid**: Predict with validation points

### Hit Detection Strategies

#### Client-Side Prediction
- Immediate visual feedback
- Show hit markers optimistically
- Validate on server
- Rollback if rejected

#### Server-Side Authority
- Server validates all hits
- Rewind to shot time
- Check target positions
- Send confirmation/rejection

## Damage Processing Pipeline

### Hit Validation Flow
1. **Client**: Fires weapon, sends to server
2. **Server**: Receives shot data with timestamp
3. **Server**: Rewinds game state to shot time
4. **Server**: Validates hit with lag compensation
5. **Server**: Applies damage if valid
6. **Server**: Broadcasts results to clients
7. **Clients**: Update visual/audio feedback

### Lag Compensation Details

#### Backward Reconciliation
- Store position history (last 1-2 seconds)
- Rewind targets to shooter's time
- Perform hit check in past state
- Apply damage in present

#### Compensation Limits
- Maximum rewind time (100-200ms typical)
- Velocity prediction for gaps
- Reject impossible shots
- Anti-cheat validation

## Weapon Balance Framework

### Balance Dimensions
1. **Damage Output**: Raw DPS potential
2. **Effective Range**: Optimal distance
3. **Versatility**: Situational usefulness
4. **Skill Ceiling**: Mastery potential
5. **Resource Cost**: Ammo/reload economy

### Weapon Roles
- **Assault**: Versatile, medium everything
- **Sniper**: High damage, low fire rate
- **Shotgun**: Close range dominance
- **SMG**: High rate, low damage
- **Explosive**: Area denial, destruction

### Counter-Play Design
- Each weapon has clear weaknesses
- Range-based advantages
- Reload windows for aggression
- Movement counters (rushing snipers)

## Performance Optimization

### Projectile Optimization
- **Limit Active Projectiles**: Cap maximum
- **Distance Culling**: Remove far projectiles
- **LOD System**: Simplify distant projectiles
- **Batch Updates**: Process together

### Network Optimization
- **Shot Compression**: Minimal data per shot
- **Batch Fire Events**: For automatic weapons
- **Priority System**: Combat over cosmetic
- **Delta Compression**: For weapon states

### Memory Management
- **Weapon Data**: Shared, not per-instance
- **Projectile Pooling**: Reuse objects
- **Effect Pooling**: Particle systems
- **Sound Pooling**: Audio sources

## Visual & Audio Design

### Weapon Feel Components
1. **Visual Recoil**: Camera/crosshair movement
2. **Audio Layers**: Fire, mechanical, echo
3. **Muzzle Effects**: Flash, smoke
4. **Shell Ejection**: If applicable
5. **Reload Animations**: Clear progress

### Hit Feedback Hierarchy
1. **Critical Hit**: Special effects/sounds
2. **Normal Hit**: Standard feedback
3. **Armor Hit**: Metallic feedback
4. **Miss**: Environmental impact

### Environmental Integration
- Underwater shooting changes
- Shooting through smoke/fog
- Weather effects on projectiles
- Material-specific impacts

## Implementation Phases

### Phase 1: Basic Shooting
- Single weapon type
- Instant hit detection
- Basic damage application
- Local effects only

### Phase 2: Network Integration
- Synchronized shooting
- Lag compensation
- Hit validation
- Basic projectiles

### Phase 3: Full Weapon System
- Multiple weapon types
- Projectile physics
- Area damage
- Reload/ammo system

### Phase 4: Polish & Balance
- Advanced effects
- Weapon progression
- Fine-tuned balance
- Anti-cheat measures

## Testing Considerations

### Functional Testing
- All weapon types
- Hit detection accuracy
- Damage calculations
- Reload/switching

### Network Testing
- High latency scenarios
- Packet loss conditions
- Hit validation edge cases
- Lag compensation limits

### Balance Testing
- Time-to-kill metrics
- Engagement range analysis
- Weapon usage statistics
- Win rate correlations

### Performance Testing
- Maximum projectiles
- Explosion cascades
- Effect spam
- Network bandwidth

## Anti-Cheat Considerations

### Common Exploits
1. **Aimbot**: Impossible accuracy
2. **Wallhack**: Shooting through walls
3. **Rapid Fire**: Bypassing fire rate
4. **Damage Modification**: Inflated damage

### Detection Methods
- Statistical analysis
- Impossible shot detection
- Fire rate validation
- Damage range checking
- Behavioral patterns

## Design Decisions

### Fire Rate Model
- **Frame-Based**: Tied to frame rate
- **Time-Based**: Independent timing
- **Tick-Based**: Fixed server ticks

### Ammo System
- **Infinite**: No ammo management
- **Magazine**: Realistic reloading
- **Pool**: Shared ammo types
- **Pickup**: Find ammo in world

### Accuracy Model
- **Perfect**: No spread
- **Random Cone**: RNG spread
- **Recoil Pattern**: Learnable spray
- **Hybrid**: Initial accuracy + recoil

## Future Enhancements

### Advanced Features
- Weapon customization system
- Elemental damage types
- Combo weapon systems
- Environmental weapons
- Weapon degradation
- Smart/guided projectiles

### Technical Evolution
- Ray-traced projectiles
- Advanced physics materials
- Neural network aim assist
- Predictive lag compensation

## Integration Checklist
- [ ] Define weapon types and roles
- [ ] Choose hit detection method
- [ ] Design lag compensation
- [ ] Plan damage calculation
- [ ] Set up projectile system
- [ ] Design feedback systems
- [ ] Plan network optimization
- [ ] Implement anti-cheat

## Critical Success Factors
1. **Responsiveness**: Immediate feedback
2. **Fairness**: Network conditions don't determine outcomes
3. **Clarity**: Players understand what happened
4. **Balance**: No dominant strategy
5. **Performance**: Maintains FPS during combat

---
*This document should be referenced when implementing the weapons system and when designing features that interact with combat mechanics.* 