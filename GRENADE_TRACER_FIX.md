# 🎯 Grenade Tracer Fix - Frontend Not Rendering Projectile Updates

## The Problem
- Grenades work (bounce, explode) but **no visual tracers**
- Backend IS sending events but frontend isn't rendering them

## What's Actually Happening

### Backend (Working Correctly) ✅
1. **Creates grenade** → Sends `PROJECTILE_CREATED` event
2. **Updates position every tick** → Sends `PROJECTILE_UPDATED` events
3. **Grenade explodes** → Sends `PROJECTILE_EXPLODED` event

### Events Being Sent:
```javascript
// Initial creation (sent once)
'projectile:created': {
  id: 'proj_123',
  type: 'grenade',
  position: { x: 100, y: 100 },
  velocity: { x: 200, y: -150 },
  timestamp: 1234567890
}

// Position updates (sent 60 times/sec)
'projectile:updated': {
  id: 'proj_123',
  position: { x: 120, y: 95 }  // New position after physics
}

// Explosion (sent once)
'projectile:exploded': {
  id: 'proj_123',
  position: { x: 500, y: 200 },
  type: 'grenade'
}
```

## Frontend Issue (Same as Weapon Trails)

The frontend is likely:
1. **Listening for `projectile:created`** ✅
2. **NOT listening for `projectile:updated`** ❌
3. **Listening for `projectile:exploded`** ✅

So it creates the grenade entity but never updates its position!

## The Fix (Frontend)

```javascript
// File: src/systems/ProjectileRenderer.ts

constructor(socket: any) {
  // Existing handler for creation
  socket.on('projectile:created', (data) => {
    this.createProjectileVisual(data);
  });
  
  // ADD THIS: Handler for position updates
  socket.on('projectile:updated', (data) => {
    this.updateProjectilePosition(data);  // ← NEW!
  });
  
  // Existing handler for explosion
  socket.on('projectile:exploded', (data) => {
    this.handleExplosion(data);
    this.removeProjectileVisual(data.id);
  });
}

// NEW METHOD - Update projectile position
private updateProjectilePosition(data: any) {
  const projectile = this.activeProjectiles.get(data.id);
  if (!projectile) return;
  
  // Update visual position
  projectile.sprite.x = data.position.x;
  projectile.sprite.y = data.position.y;
  
  // Optional: Add trail effect
  if (this.showTrails) {
    this.addTrailPoint(data.id, data.position);
  }
}
```

## Alternative: Use Game State Projectiles

The backend also sends projectiles in the game state every network tick:

```javascript
// In game:state event
gameState.projectiles: [
  {
    id: 'proj_123',
    type: 'grenade',
    position: { x: 120, y: 95 },
    velocity: { x: 200, y: -100 },
    // ... other fields
  }
]
```

Frontend could update projectiles from this instead:

```javascript
socket.on('game:state', (state) => {
  // Update all projectile positions
  for (const projectileData of state.projectiles) {
    this.updateProjectilePosition({
      id: projectileData.id,
      position: projectileData.position
    });
  }
});
```

## Quick Test

To verify backend is sending updates:

```javascript
// Add to frontend temporarily
socket.on('projectile:updated', (data) => {
  console.log('📍 Projectile update received:', data);
});

// Should see 60 logs/second while grenade is flying
```

## Summary

**Backend:** ✅ Sending all events correctly
- `projectile:created` - Initial spawn
- `projectile:updated` - Position updates (60Hz)  
- `projectile:exploded` - Explosion

**Frontend:** ❌ Not listening to `projectile:updated`
- Creates grenade visual but never moves it
- Same issue as weapon trails - ignoring update events

**Fix:** Add handler for `projectile:updated` events!
