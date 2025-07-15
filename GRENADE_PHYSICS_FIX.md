# Grenade Physics Fix

## Problem
Grenades were moving too fast (appearing to be 160+ px/s instead of the intended 8-32 px/s range). The issue was suspected to be velocity being applied per physics tick rather than per second.

## Root Causes

1. **Stuck Projectiles**: Old grenades from previous tests were stuck at extreme positions (e.g., x=20040), causing confusion in logs
2. **Package.json Error**: Start script was pointing to wrong file (`dist/index.js` instead of `dist/src/index.js`)
3. **Matter.js Integration**: Properly configured - velocity IS in pixels per second, not per tick

## Solution

### 1. Fixed Package.json
```json
"start": "node dist/src/index.js"
```

### 2. Added Projectile Clearing
```javascript
// Debug endpoint to clear stuck projectiles
socket.on('debug:clear_projectiles', () => {
  this.gameState.getProjectileSystem().clear();
  console.log('🧹 All projectiles cleared');
});
```

### 3. Physics System Architecture
- Matter.js bodies for walls (static, friction=0.8, restitution=0.5)
- Grenades use Matter.js physics bodies (circle, radius=2)
- Velocity properly set in px/s: `2 + (chargeLevel * 6)` = 8-32 px/s
- Physics engine handles collisions automatically

## Velocity Calculations
- Charge Level 1: 2 + (1 * 6) = 8 px/s
- Charge Level 2: 2 + (2 * 6) = 14 px/s  
- Charge Level 3: 2 + (3 * 6) = 20 px/s
- Charge Level 4: 2 + (4 * 6) = 26 px/s
- Charge Level 5: 2 + (5 * 6) = 32 px/s

## Testing

### Clear Projectiles Script
```javascript
// clear-projectiles.js
const io = require('socket.io-client');
const socket = io('http://localhost:3000');

socket.on('connect', () => {
  console.log('✅ Connected - clearing projectiles...');
  socket.emit('debug:clear_projectiles');
  setTimeout(() => {
    console.log('✨ Done');
    process.exit(0);
  }, 500);
});
```

### Test Grenade Physics
```javascript
// test-grenade-physics-clean.js
// Tests grenade movement and calculates actual speed
// Verifies physics-based collision system
```

## Commands

1. Build: `npm run build`
2. Start server: `npm start`
3. Clear projectiles: `node clear-projectiles.js`
4. Test physics: `node test-grenade-physics-clean.js`

## Key Changes from Previous Implementation

1. **Removed manual collision detection for grenades** - Matter.js handles it
2. **Added physics bodies to all walls** including boundaries
3. **Fixed velocity application** - confirmed Matter.js uses px/s correctly
4. **Added debug tools** for clearing stuck projectiles

## Verification

After implementing these fixes:
- Grenades move at correct speeds (8-32 px/s based on charge)
- Collisions are handled smoothly by Matter.js
- No more infinite collision loops
- No more grenades stuck at extreme positions 