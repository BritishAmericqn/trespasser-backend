# 🎮 TRESPASSER FRONTEND → BACKEND HANDOVER

## 📋 **Frontend Status: COMPLETE**
✅ Input System implemented with mouse-direction sprint  
✅ Network System ready for Socket.io communication  
✅ Input data transmitted at 20Hz to backend  
✅ Local player movement with immediate feedback  

---

## 🔌 **Socket.io Configuration**

### **Connection Details**
- **Frontend connects to**: `http://localhost:3000`  
- **Transport**: `websocket`  
- **Auto-reconnection**: Enabled (max 5 attempts)  

### **Events the Backend Must Handle**

```typescript
// INCOMING: Input from frontend (20 times per second)
socket.on('player:input', (inputData: InputState) => {
  // Handle player input here
});

// OUTGOING: Game state updates to frontend
socket.emit('game:state', gameStateData);

// OUTGOING: Player connection events
socket.emit('player:joined', playerData);
socket.emit('player:left', playerData);
```

---

## 📊 **Input Data Structure**

### **InputState Interface**
```typescript
interface InputState {
  keys: {
    w: boolean;        // Up/North movement
    a: boolean;        // Left/West movement  
    s: boolean;        // Down/South movement
    d: boolean;        // Right/East movement
    shift: boolean;    // Sprint modifier
    ctrl: boolean;     // Sneak modifier
  };
  mouse: {
    x: number;         // Mouse X position (0-480)
    y: number;         // Mouse Y position (0-270)
  };
  sequence: number;    // Incremental counter for input ordering
  timestamp: number;   // Client timestamp (Date.now())
}
```

### **Example Input Data**
```json
{
  "keys": {
    "w": true,
    "a": false,
    "s": false,
    "d": false,
    "shift": true,
    "ctrl": false
  },
  "mouse": {
    "x": 350,
    "y": 100
  },
  "sequence": 1247,
  "timestamp": 1703123456789
}
```

---

## 🏃 **Movement System Logic**

### **1. Movement Speed Calculation**
```typescript
function calculateMovementSpeed(keys: InputState['keys'], mouseDirection: string): number {
  // Sneak mode (50% speed)
  if (keys.ctrl) {
    return 0.5;
  }
  
  // Sprint mode (150% speed) - only when moving toward mouse
  if (keys.shift && isMovingTowardMouse(keys, mouseDirection)) {
    return 1.5;
  }
  
  // Normal speed (100%)
  return 1.0;
}
```

### **2. Mouse Direction Calculation**
```typescript
function getForwardDirection(playerX: number, playerY: number, mouseX: number, mouseY: number): 'w' | 'a' | 's' | 'd' {
  const angle = Math.atan2(mouseY - playerY, mouseX - playerX);
  const degrees = (angle * 180 / Math.PI + 360) % 360;
  
  // Quadrant mapping:
  if (degrees >= 315 || degrees < 45) {
    return 'd'; // East (right)
  } else if (degrees >= 45 && degrees < 135) {
    return 's'; // South (down)
  } else if (degrees >= 135 && degrees < 225) {
    return 'a'; // West (left)
  } else {
    return 'w'; // North (up)
  }
}

function isMovingTowardMouse(keys: InputState['keys'], forwardDirection: string): boolean {
  return keys[forwardDirection];
}
```

### **3. Movement Direction Vector**
```typescript
function getMovementVector(keys: InputState['keys']): { x: number; y: number } {
  let x = 0;
  let y = 0;

  if (keys.a) x -= 1;  // Left
  if (keys.d) x += 1;  // Right
  if (keys.w) y -= 1;  // Up
  if (keys.s) y += 1;  // Down

  // Normalize diagonal movement
  if (x !== 0 && y !== 0) {
    const length = Math.sqrt(x * x + y * y);
    x /= length;
    y /= length;
  }

  return { x, y };
}
```

---

## 🎯 **Game Constants**

```typescript
const GAME_CONFIG = {
  GAME_WIDTH: 480,
  GAME_HEIGHT: 270,
  TICK_RATE: 60,           // Server physics rate
  NETWORK_RATE: 20,        // Input transmission rate
  PLAYER_SPEED_WALK: 100,  // Base movement speed
  PLAYER_HEALTH: 100
};
```

---

## 🔧 **Backend Implementation Requirements**

### **1. Input Validation**
```typescript
function validateInput(input: InputState): boolean {
  // Validate sequence numbers for cheat detection
  // Validate timestamps for lag compensation
  // Validate mouse coordinates are within bounds
  // Validate key combinations are physically possible
  
  return (
    input.sequence > 0 &&
    input.timestamp > 0 &&
    input.mouse.x >= 0 && input.mouse.x <= 480 &&
    input.mouse.y >= 0 && input.mouse.y <= 270
  );
}
```

### **2. Player State Management**
```typescript
interface PlayerState {
  id: string;
  position: { x: number; y: number };
  velocity: { x: number; y: number };
  health: number;
  team: 'red' | 'blue';
  isAlive: boolean;
  lastInputSequence: number;
  lastUpdateTime: number;
}
```

### **3. Physics Update Loop**
```typescript
function updatePlayerMovement(player: PlayerState, input: InputState, deltaTime: number): void {
  // Calculate forward direction based on mouse
  const forwardDir = getForwardDirection(player.position.x, player.position.y, input.mouse.x, input.mouse.y);
  
  // Calculate movement speed
  const speed = calculateMovementSpeed(input.keys, forwardDir);
  
  // Get movement vector
  const movement = getMovementVector(input.keys);
  
  // Apply movement
  const moveSpeed = GAME_CONFIG.PLAYER_SPEED_WALK * speed * deltaTime;
  player.position.x += movement.x * moveSpeed;
  player.position.y += movement.y * moveSpeed;
  
  // Boundary checks
  player.position.x = Math.max(10, Math.min(player.position.x, 470));
  player.position.y = Math.max(10, Math.min(player.position.y, 260));
}
```

---

## 🌐 **Network Architecture**

### **Input Flow**
1. **Frontend** → Captures input at 60 FPS
2. **Frontend** → Sends input to backend at 20 Hz
3. **Backend** → Processes input with server-side validation
4. **Backend** → Updates game state at 60 TPS
5. **Backend** → Sends game state to clients at 20 Hz

### **Lag Compensation**
- Use `timestamp` field for rollback/prediction
- Use `sequence` field for input ordering
- Implement client-side prediction for smooth movement
- Server has final authority on all positions

---

## 🚀 **Next Steps for Backend**

### **Immediate Implementation**
1. ✅ Set up Socket.io server on port 3000
2. ✅ Handle `player:input` events  
3. ✅ Implement movement calculation functions
4. ✅ Add input validation and cheat detection
5. ✅ Create game state broadcast system

### **Testing**
- Frontend is ready at `http://localhost:5176`
- Test with multiple clients for multiplayer
- Verify sprint system works in all directions
- Check input validation and boundary enforcement

### **Performance Notes**
- Input rate: 20 packets/second per player
- Physics tick rate: 60 Hz recommended
- Network update rate: 20 Hz recommended
- Use delta time for frame-independent movement

---

## 🎮 **Frontend Features Ready**

✅ **WASD Movement**: All directions supported  
✅ **3 Movement Speeds**: Sneak (50%), Walk (100%), Sprint (150%)  
✅ **Mouse-Direction Sprint**: Sprint toward mouse cursor  
✅ **Real-time Input**: 20Hz transmission to backend  
✅ **Local Prediction**: Immediate visual feedback  
✅ **Connection Management**: Auto-reconnect on disconnect  

**The frontend is production-ready and waiting for the backend! 🎯** 