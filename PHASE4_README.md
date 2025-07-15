# Phase 4: Core Gameplay Systems - Implementation Guide

## 📁 Files Created

1. **`BACKEND_KICKOFF_PHASE4.md`** - Backend implementation prompt
2. **`FRONTEND_KICKOFF_PHASE4.md`** - Frontend implementation prompt

## 🚀 Implementation Order

### Why Backend First?

1. **Backend validates all collision events** → Frontend needs confirmed positions
2. **Backend calculates vision/fog of war** → Frontend renders based on this data
3. **Backend filters player visibility** → Frontend only receives visible players
4. **Backend can be tested independently** → Using test scripts

### Recommended Timeline

#### **Days 1-2: Backend Implementation**
1. Player-wall collision system (4 hours)
2. Fog of war vision calculations (6 hours)
3. Player visibility filtering (4 hours)
4. Testing & debugging (4 hours)

#### **Days 2-3: Frontend Implementation**
1. Test backend changes (2 hours)
2. Multiplayer player rendering (4 hours)
3. Fog of war visualization (6 hours)
4. Collision feedback & polish (4 hours)

#### **Day 3: Integration**
1. Full system testing (2 hours)
2. Performance optimization (2 hours)
3. Bug fixes and polish (2 hours)

## 🎯 Phase 4 Goals

After completing Phase 4, you will have:

- ✅ **Players cannot walk through walls**
- ✅ **Fog of war hides unseen areas**
- ✅ **Other players visible in multiplayer**
- ✅ **Smooth collision feedback**
- ✅ **Server-side anti-cheat (no wallhacks)**

## 🔧 Technical Overview

### Backend Systems
- **Collision**: Matter.js physics bodies for players
- **Vision**: Scanline algorithm on 480x270 grid
- **Filtering**: Per-player game state based on visibility

### Frontend Systems
- **Rendering**: Interpolated multiplayer sprites
- **Fog**: Overlay texture with vision cutouts
- **Feedback**: Smooth collision corrections

## 📊 Success Metrics

- **Performance**: 60 FPS with 8 players
- **Network**: < 5KB/s per player
- **Latency**: Vision updates < 50ms
- **Security**: No client can see through walls

## 🚨 Critical Points

1. **Don't let physics engine control player movement** - It should only detect collisions
2. **Never trust client vision data** - Server must be authoritative
3. **Cache vision calculations** - Only recalculate on movement/destruction
4. **Interpolate everything on frontend** - 20Hz → 60Hz needs smoothing

## 📞 Communication Between Teams

### Backend → Frontend Events
```typescript
// Game state (20Hz)
'gameState': FilteredGameState

// Collision corrections
'collision': CollisionEvent

// Vision updates
'visionUpdate': VisionMask
```

### Frontend → Backend Events
```typescript
// Movement input (already implemented)
'player:input': InputData

// No new events needed for Phase 4
```

## 🎮 Testing Strategy

1. **Backend Testing**
   - Create test script for wall collisions
   - Verify vision calculations with known scenarios
   - Test visibility filtering with multiple players

2. **Frontend Testing**
   - Open multiple browser tabs
   - Use Chrome DevTools network throttling
   - Test with 8 players simultaneously

3. **Integration Testing**
   - Verify fog updates on wall destruction
   - Test player appearance/disappearance
   - Check collision feedback smoothness

## 🚀 Ready to Start?

1. **Backend Developer**: Open `BACKEND_KICKOFF_PHASE4.md`
2. **Frontend Developer**: Wait for backend, then use `FRONTEND_KICKOFF_PHASE4.md`
3. **Both**: Coordinate on the event interfaces

Good luck with Phase 4! 🎮 