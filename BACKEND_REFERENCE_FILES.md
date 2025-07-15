# 📁 BACKEND REFERENCE FILES

## 🎯 **Key Frontend Files to Review**

### **1. Input System Implementation**
- **File**: `src/client/systems/InputSystem.ts`
- **Purpose**: Shows exactly how input is captured and processed
- **Key Methods**:
  - `getForwardDirection()` - Mouse direction calculation
  - `getMovementSpeed()` - Speed calculation logic
  - `getMovementDirection()` - Movement vector calculation

### **2. Network System**
- **File**: `src/client/systems/NetworkSystem.ts`
- **Purpose**: Shows Socket.io configuration and event handling
- **Key Events**: `player:input`, `game:state`, `player:joined`, `player:left`

### **3. Shared Constants**
- **File**: `shared/constants/index.ts`
- **Purpose**: Game configuration that must match backend
- **Important**: GAME_CONFIG values, EVENTS names

### **4. Shared Types**
- **File**: `shared/types/index.ts`
- **Purpose**: Data structures that must match backend
- **Key Interfaces**: `Vector2`, `PlayerState`, `GameState`

### **5. Game System Interface**
- **File**: `shared/interfaces/IGameSystem.ts`
- **Purpose**: System architecture pattern

---

## 🔧 **Testing the Frontend**

### **Current Status**
- **Running on**: `http://localhost:5176`
- **State**: Production-ready, waiting for backend
- **Features**: Full input system with mouse-direction sprint

### **Test Commands**
```bash
# Navigate to frontend directory
cd trespasser-frontend

# Start the frontend
npm run dev

# Will automatically find available port (5176 currently)
```

### **Testing Scenarios**
1. **Movement**: WASD keys in all directions
2. **Sprint**: Hold Shift + move toward mouse cursor
3. **Sneak**: Hold Ctrl + any movement
4. **Speed Changes**: Watch player color change (Green→Blue→Red)
5. **Mouse Tracking**: Move mouse to see forward direction update

---

## 🎮 **What You'll See**

### **Visual Feedback**
- **🟢 Green Square**: Normal movement (100%)
- **🔵 Blue Square**: Sneaking (50%)
- **🔴 Red Square**: Sprinting (150%)

### **Debug Info**
- **Keys**: Current key states
- **Mouse**: Mouse position
- **Forward Dir**: Which direction is "forward" (↑→↓←)
- **Speed**: Current movement speed percentage

---

## 🚀 **Ready for Backend Integration**

The frontend is **completely ready** and will work immediately once the backend:
1. Starts Socket.io server on port 3000
2. Handles the `player:input` events
3. Implements the movement logic from `BACKEND_HANDOVER.md`

**No frontend changes needed - just connect and go! 🎯** 