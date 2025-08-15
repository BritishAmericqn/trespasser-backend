# 🚨 CRITICAL: Frontend Must Listen for Correct Events

## ✅ BACKEND IS SENDING DATA CORRECTLY

Looking at the server logs, the backend IS sending game state:
```
📤 Sending initial game state to [player]: { players: 1, walls: 79, projectiles: 0 }
📡 Using event name: "game:state"
```

## 🔴 THE PROBLEM: Frontend Not Listening Correctly

The frontend MUST listen for these EXACT event names:

### 1. **Initial Game State** (sent when you join)
```javascript
socket.on('game:state', (data) => {
  console.log('📨 GAME STATE received', data);
  // data contains: { players, walls, projectiles, vision, visiblePlayers }
  
  // CRITICAL: Process walls
  if (data.walls) {
    console.log(`📦 Updating walls from game state: ${Object.keys(data.walls).length} walls`);
    // Your wall update code here
  }
});
```

### 2. **Player Join Confirmation**
```javascript
socket.on('player:joined', (playerData) => {
  console.log('Player joined event:', playerData);
  // This is OTHER players joining
});
```

### 3. **Lobby Events** (different from game events!)
```javascript
socket.on('lobby_joined', (data) => {
  console.log('Joined lobby:', data);
  // data: { lobbyId, playerCount, maxPlayers, status }
});

socket.on('player_joined_lobby', (data) => {
  console.log('Player joined lobby:', data);
  // data: { lobbyId, playerCount, playerId, timestamp }
});

socket.on('match_starting', (data) => {
  console.log('Match starting:', data);
  // data: { lobbyId, countdown }
});

socket.on('match_started', (data) => {
  console.log('Match started:', data);
  // data: { lobbyId, killTarget }
});
```

## 📊 EXACT DATA STRUCTURE FROM BACKEND

When backend sends `game:state`, it contains:

```javascript
{
  players: {
    'socket_id_1': {
      id: 'socket_id_1',
      position: { x: 45, y: 85 },
      rotation: 0,
      velocity: { x: 0, y: 0 },
      health: 100,
      team: 'red',
      weaponId: 'rifle',
      weapons: Map { ... },
      isAlive: true,
      // ... more fields
    }
  },
  walls: {
    'wall_1': {
      id: 'wall_1',
      position: { x: 40, y: 0 },
      width: 10,
      height: 50,
      orientation: 'vertical',
      destructionMask: [0, 0, 0, 0, 0],
      material: 'concrete',
      maxHealth: 675,
      sliceHealth: [675, 675, 675, 675, 675]
    },
    // ... 78 more walls
  },
  projectiles: [],
  vision: { /* visibility polygon data */ },
  visiblePlayers: { /* filtered by vision */ }
}
```

## 🔧 FRONTEND FIX CHECKLIST

1. **Check your socket listener:**
   ```javascript
   // MUST BE EXACTLY THIS:
   socket.on('game:state', (data) => {
     // NOT 'gameState' or 'game_state' or 'GAME_STATE'
     // EXACTLY: 'game:state'
   });
   ```

2. **Add console logging:**
   ```javascript
   socket.on('game:state', (data) => {
     console.log('📨 GAME STATE received - Scene:', this.scene.key, 
                 'Players:', Object.keys(data.players || {}).length,
                 'Walls:', Object.keys(data.walls || {}).length);
     
     if (data.walls) {
       console.log('📦 Wall data sample:', Object.values(data.walls)[0]);
     }
   });
   ```

3. **Check you're sending player:join:**
   ```javascript
   // After entering game scene:
   socket.emit('player:join', {
     loadout: { 
       primary: 'rifle', 
       secondary: 'pistol', 
       support: ['grenade'],
       team: 'red'  // or 'blue'
     },
     timestamp: Date.now()
   });
   ```

4. **Or request state explicitly:**
   ```javascript
   socket.emit('request_game_state', {});
   ```

## 🧪 TEST THIS NOW

Add this to your game scene:

```javascript
// In your GameScene create() or constructor:
this.socket.on('game:state', (data) => {
  console.log('🚨 GAME STATE RECEIVED!', {
    scene: this.scene.key,
    players: Object.keys(data.players || {}).length,
    walls: Object.keys(data.walls || {}).length,
    wallsSample: data.walls ? Object.values(data.walls)[0] : null
  });
  
  // Your wall rendering code here
  if (data.walls) {
    this.updateWalls(data.walls);
  }
});

// Also listen for all events to debug:
this.socket.onAny((event, data) => {
  console.log(`📡 Event received: "${event}"`, data);
});

// Send join event
this.socket.emit('player:join', {
  loadout: { 
    primary: 'rifle', 
    secondary: 'pistol', 
    support: ['grenade'],
    team: 'red'
  },
  timestamp: Date.now()
});

// Also try requesting state
setTimeout(() => {
  console.log('🔄 Requesting game state...');
  this.socket.emit('request_game_state', {});
}, 1000);
```

## 🎯 EXPECTED CONSOLE OUTPUT

You should see:
```
📡 Event received: "lobby_joined" { lobbyId: "deathmatch_xxx", ... }
📡 Event received: "game:state" { players: {...}, walls: {...} }
🚨 GAME STATE RECEIVED! { scene: "GameScene", players: 1, walls: 79 }
📡 Event received: "player:joined" { id: "xxx", ... }
📡 Event received: "match_starting" { countdown: 5 }
📡 Event received: "match_started" { killTarget: 50 }
📡 Event received: "game:state" { ... } // regular updates
```

## ❌ IF YOU SEE NO EVENTS

1. Check your socket connection:
   ```javascript
   console.log('Socket connected?', this.socket.connected);
   console.log('Socket ID:', this.socket.id);
   ```

2. Make sure you're using the right socket instance

3. Make sure you're in the GameScene when listening

4. Check for typos in event names

## 🔥 THE KEY ISSUE

The backend IS sending `'game:state'` with 79 walls. If you're not receiving it, you're either:
1. Not listening for the exact event name `'game:state'`
2. Not in the right scene/context when the event arrives
3. Using a different socket instance

Add the debug code above and check your console!
