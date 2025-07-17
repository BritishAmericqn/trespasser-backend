# Trespasser: Technical Post-Mortem

## How Everything Changed Overnight

Going into this project, I was convinced we'd have to cut half the features. The original spec looked impossible:
- 16-player multiplayer with complex FOV calculations
- Vision through small bullet holes in walls
- Real-time audio muffling through destructible geometry
- 5 vertical destruction slices per wall
- Three movement speeds with sound propagation
- Physics-based grenades and rockets
- Mouse-controlled extended vision

Then I found out the actual requirement: **1v1 to 4v4 gameplay**. Not 16 players. **8 players maximum**.

That single revelation changed everything. 75% complexity reduction overnight. Suddenly every "impossible" feature became not just possible, but easy.

## The Vision System Saga

### Phase 1: Pixel-Perfect Nightmare
I started naive. "Let's calculate visibility for every single pixel!" 129,600 pixels at 480x270. For each pixel, check if it's blocked by walls. For each player.

The math was brutal:
- 129,600 pixels × 8 players × 12 walls = **12.4 million checks per frame**
- Running at 60Hz = **744 million calculations per second**
- Creating string coordinates: `visiblePixels.add("x,y")` for every visible pixel
- With 3,600+ visible pixels per player = 28,800 string allocations every tick

Server lasted about 30 seconds before crashing. Classic.

### Phase 2: Tile-Based Recovery
Pivoted to 16x16 pixel tiles. Instead of 129,600 pixels, check 510 tiles (30x17 grid). 99% reduction in calculations. Vision looked chunky but the server stopped crashing.

But I wasn't satisfied with the visual quality. 16x16 tiles were too coarse for 480x270. You could hide behind single-pixel walls. So I went smaller.

### Phase 3: Higher Resolution Tiles
Shrunk tiles to 8x8 pixels. Now 60x34 grid (2,040 tiles). 4x more calculations but still manageable. Much better visual fidelity - you could actually see through bullet holes properly.

But the real breakthrough was switching from string coordinates to numeric indices. Instead of `"15,8"` strings, just store tile index `255`. 67% bandwidth reduction, eliminated string allocation overhead.

### Phase 4: The Polygon Vision Experiment
Tiles were working, but I got greedy. "What if we could get pixel-perfect vision without the performance cost?" 

Implemented visibility polygon system using wall corners. Cast rays only to wall corners instead of scanning every tile. Sounded brilliant in theory.

Results: 88.9% CPU usage. The corner-to-corner ray casting with proper arc interpolation was insanely expensive. Each player needed 40-60 rays to every wall corner, with complex geometric calculations.

Reverted to tile-based after one day. Sometimes "good enough" is actually better than "perfect."

### Phase 5: Slice-Aware Raycasting
The final evolution. Kept the 8x8 tile base but added smart raycasting through destroyed wall slices. When a wall has destroyed segments, rays can pass through those specific 2-pixel-wide gaps.

This solved the precision issue without the polygon system complexity. You can shoot through a bullet hole and see exactly what's behind it, but the system still runs at ~2ms for 8 players.

## The Physics Engine Discovery

The vision system got all the attention, but the real performance killer was hiding in plain sight: **Matter.js running at 60Hz with nothing to do**.

Every frame, even with zero projectiles and stationary players:
- Physics engine updating all 12 wall bodies
- Collision detection between everything and nothing
- Complex constraint solving for static geometry

My laptop was getting hot just running an empty server. CPU usage at 30-50% with no players connected.

The fix was embarrassingly simple: `if (activeBodies.size === 0) return;`

Only run physics when grenades are bouncing around. CPU dropped to 5-10% idle.

## The String Allocation Catastrophe

Every performance problem teaches you something. This one taught me that JavaScript string allocation is expensive as hell.

```javascript
visiblePixels.add(`${x},${y}`); // Don't do this 28,800 times per frame
```

I was creating coordinate strings for every visible pixel. 3,600 pixels per player × 8 players × 10 times per second = **288,000 string objects per second**. Each one triggering garbage collection.

The fix: numeric tile indices. Instead of `"15,8"`, just store `255`. One integer instead of a string object. Bandwidth dropped 67%, GC pressure disappeared.

## Debug Logs Are Production Killers

Had debug logs scattered everywhere. "Only 5% probability, how bad could it be?" 

Bad. Each `console.log()` in a browser triggers DOM manipulation. With 60Hz input processing, even 5% meant 3 logs per second per player. Multiply by 8 players across multiple systems.

When I ripped out all debug logs, performance jumped 15%. Production discipline matters.

## Early Exit Everything

The most important optimization pattern:
```javascript
if (this.projectiles.size === 0) {
  return; // Don't process empty data
}
```

Applied this everywhere. ProjectileSystem, vision updates, physics calculations. The fastest code is code that doesn't run.

## The Grenade Physics Nightmare

Grenades were the most frustrating system. They'd get stuck bouncing infinitely, or phase through walls, or explode at coordinates like `(20040, -12961)`.

Tried three approaches:
1. **Full Matter.js physics** - Grenades got stuck in collision loops
2. **Manual collision detection** - Complicated, buggy, inconsistent  
3. **Hybrid approach** - Combined the worst of both

Final solution: Pure manual physics with swept sphere collision detection. Check 5 interpolated points along the grenade's path each frame instead of relying on Matter.js continuous collision detection.

Grenades now bounce properly, slow down with friction, and explode on a 3-second timer without getting stuck.

## Architecture Decisions That Mattered

### Server Authority: Security Over Speed
Chose full server authority from day one. Every action validated server-side. Client position, weapon firing angle, movement speed - all calculated on the backend.

Yes, this adds 50-100ms latency. But it completely eliminates:
- Speed hacking
- Wallhacks  
- Aimbot assistance
- Position spoofing

For a competitive shooter, security trumps low latency. Plus, client prediction hides most of the delay anyway.

### Event-Driven Everything
No system talks directly to another. Everything goes through events:
- WeaponSystem fires `wall:damaged` event
- VisionSystem listens and updates visibility  
- DestructionSystem handles the damage application
- UI system updates health bars

This made debugging infinitely easier. I could disable entire systems and the game kept running. Isolation enabled optimization - spent days tuning the vision system without touching weapons or physics.

### Component Over Inheritance
No class hierarchies. No `extends Enemy extends Entity extends GameObject`. Just systems operating on data.

Movement, vision, weapons, destruction - all separate systems. Mix and match functionality by composing components, not inheriting behavior.

Made the codebase incredibly maintainable. When the polygon vision experiment failed, I swapped it out in one line without touching anything else.

## The 5-Slice Destruction System

This was the feature I was most worried about. "5 vertical slices per wall" sounded complex and expensive. Turns out it was simpler than expected.

Each wall divides into 5 slices:
- Horizontal walls: 5 vertical strips (left to right)  
- Vertical walls: 5 horizontal strips (top to bottom)
- Each slice: ~2 pixels wide at our resolution
- Storage: Bit mask (`00101` = slices 0 and 2 destroyed)

Memory footprint: **128 bytes per wall**. For the entire destruction system. Bit operations are fast, storage is tiny, network sync is trivial.

The vision integration was trickier. Initially, damaging any slice made the entire wall transparent. Shoot one slice = 50px vision leak through a 10px hole.

Fixed with slice-aware raycasting. When a ray hits a wall, calculate which slice it passes through. Only allow the ray to continue if that specific slice is destroyed.

Now you can create precise sight lines by destroying specific wall segments. Tactical depth through technical precision.

## Integration Challenges I Actually Hit

### The Frontend Event Problem
Backend calculated everything perfectly. Wall damage, vision updates, rocket collisions. All working. But frontend wasn't using any of the data.

Root cause: Missing event propagation. Backend would calculate that a rocket hit a wall, but frontend never received the `wall:damaged` event. So walls appeared invincible from the client perspective.

Spent days debugging collision detection when the real issue was a missing `socket.emit()`.

### Position Desync Mystery
Players would move differently on frontend vs backend. Same input, different results. Backend calculating 240.67, frontend showing 241.15.

Turned out to be two separate bugs:
1. Frontend not applying server position corrections
2. Backend using wrong scale factor in rotation calculations

Both systems were "correct" in isolation, but wrong together. Integration is where bugs hide.

### The Rocket Through Wall Bug
Rockets would fly straight through walls and explode outside the map at coordinates like `(395.7, -53.1)`. Collision detection code was perfect... but it ran after boundary checks.

The fix was reordering collision detection to happen before range/boundary validation. Rockets now properly explode when hitting walls instead of flying into the void.

## What I Learned About Performance

### Player Count Dominates Everything
Going from 16 to 8 players wasn't just "half the complexity." It was **75% reduction** because of quadratic scaling effects. Network messages, collision checks, vision calculations - everything scales with player count squared, not linearly.

8 players let me be sloppy and still hit performance targets. 16 players would have required perfect optimization everywhere.

### Resolution as Technical Architecture
480x270 pixel art wasn't just an art style choice. It was a **technical architecture decision** that made everything else possible.

- Vision calculations: 90% fewer pixels to check
- Natural tile boundaries: Perfect fit for 8x8 tiles  
- Collision detection: Simpler math with integer coordinates
- Network bandwidth: Smaller coordinate values

The "chunky" aesthetic actually made the game run better.

### Always Profile First
Spent weeks optimizing vision algorithms from 31 million to 500,000 calculations per second. Felt proud of the 98% improvement.

Then discovered Matter.js was eating 30% CPU just sitting there doing nothing. Fixed that in 5 minutes with an early exit.

The lesson: **Profile before optimizing**. The biggest performance wins are usually hiding in plain sight.

### Network Bandwidth is Never the Bottleneck
Projected 10KB/s per player. Actually using 2KB/s. Even with inefficient JSON serialization and uncompressed coordinates.

Modern networks can handle way more data than you think. CPU and memory pressure kill games, not bandwidth.

## Final Outcome

**Starting assumption**: "Impossible with 16 players, must cut 50% of features"  
**Final reality**: "All features working with 8 players, could add 50% more"

The technical implementation validated the original game design vision. Sometimes "impossible" just means "needs different constraints."

---

**Key Success Factors:**
- Questioned the requirements early (16 vs 8 players)
- Chose appropriate technical constraints (480x270 resolution)  
- Profiled systematically instead of guessing
- Built modular systems that could be optimized in isolation
- Accepted "good enough" instead of chasing perfection

The most important optimization was realizing I didn't need to optimize most things. 