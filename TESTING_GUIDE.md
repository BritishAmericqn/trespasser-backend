# 🧪 Testing Guide for Player Input System

## Overview
This guide covers multiple ways to test the player input system implementation in the Trespasser backend.

## 🚀 **Method 1: Start the Server**

### Step 1: Run the Backend Server
```bash
# Install dependencies (if not already done)
npm install

# Start the development server
npm run dev
```

**Expected Output:**
```
🚀 Server running on port 3000
🎮 Game tick rate: 60 Hz
🌐 Network rate: 20 Hz
GameStateSystem initialized
PhysicsSystem initialized
```

### Step 2: Check Server Status
- Server should be running on `http://localhost:3000`
- Socket.io should be accepting connections
- Physics system should be running at 60Hz
- Network updates should be at 20Hz

---

## 🌐 **Method 2: Visual HTML Test Client**

### Step 1: Open the Test Client
```bash
# With server running, open in browser:
open test-client.html
# Or navigate to the file in your browser
```

### Step 2: Test Features
**Movement Controls:**
- **WASD keys**: Move player around
- **Shift + WASD**: Run (red player dot)
- **Ctrl + WASD**: Sneak (green player dot)
- **Mouse movement**: Rotate player

**Visual Feedback:**
- Player dot color changes based on movement state:
  - 🔴 Red = Running
  - 🔵 Blue = Walking  
  - 🟢 Green = Sneaking
  - ⚫ Gray = Idle

**Real-time Information:**
- Connection status indicator
- Live position, rotation, and speed display
- Input log showing sent commands
- Game state updates from server

### Step 3: What to Look For
✅ **Good Signs:**
- Connection indicator shows green "Connected"
- Player dot moves smoothly
- Position updates in real-time
- Movement state changes correctly
- Mouse rotation works
- Input log shows sent commands

❌ **Problems to Watch For:**
- Connection fails (red indicator)
- Player doesn't move or jumps
- Movement state doesn't change
- Mouse rotation doesn't work
- No input logs appearing

---

## 🤖 **Method 3: Automated Test Script**

### Step 1: Run Automated Tests
```bash
# With server running in another terminal:
node test-input.js
```

### Step 2: Test Coverage
The automated tests will verify:

**Movement Tests:**
- ✅ Idle state (no keys pressed)
- ✅ Walking in all directions (WASD)
- ✅ Diagonal movement (W+D, etc.)
- ✅ Running (Shift + movement)
- ✅ Sneaking (Ctrl + movement)

**Rotation Tests:**
- ✅ Mouse pointing right (0°)
- ✅ Mouse pointing up (-90°)
- ✅ Mouse pointing left (180°)
- ✅ Mouse pointing down (90°)

**Boundary Tests:**
- ✅ Player stays within game area
- ✅ Position clamping works correctly

**Security Tests:**
- ✅ Old sequence numbers rejected
- ✅ Invalid mouse positions rejected
- ✅ Valid inputs accepted

### Step 3: Expected Output
```
🚀 Starting comprehensive input tests...

✅ Connected to server
🎮 Initial player state received - Position: (240.00, 135.00)

🧪 Testing: Idle state
✅ Idle state - Movement state: idle
   Position change: (0.00, 0.00) - Distance: 0.00

🧪 Testing: Walking forward
✅ Walking forward - Movement state: walking
   Position change: (0.00, -15.23) - Distance: 15.23

... (more tests)

📊 Test Results Summary:
✅ Passed: 8/8
❌ Failed: 0/8
🎉 All tests passed! Input system is working correctly.
```

---

## 🔧 **Method 4: Test with Real Frontend**

### Step 1: Run Frontend
```bash
# In your frontend directory:
npm run dev
# Should start on http://localhost:5176
```

### Step 2: Test Integration
- Open frontend in browser
- Move around with WASD
- Check if movement is smooth
- Verify speed differences (walk/run/sneak)
- Test mouse rotation

### Step 3: Multi-Client Testing
- Open multiple browser tabs/windows
- Each should show as separate players
- Test multiplayer movement
- Verify other players' positions update

---

## 🐛 **Common Issues & Solutions**

### Issue: Connection Refused
**Problem:** `Error: connect ECONNREFUSED 127.0.0.1:3000`
**Solution:** 
- Make sure server is running (`npm run dev`)
- Check that port 3000 is not in use by another app
- Verify firewall isn't blocking the connection

### Issue: Player Not Moving
**Problem:** Input sent but player stays in place
**Solution:**
- Check server logs for error messages
- Verify input validation isn't rejecting commands
- Ensure Matter.js physics is running

### Issue: Input Validation Errors
**Problem:** Server shows "Invalid input" warnings
**Solution:**
- Check timestamp tolerance (should be < 1 second)
- Verify sequence numbers are increasing
- Ensure mouse coordinates are within bounds

### Issue: Movement Feels Laggy
**Problem:** Player movement is choppy or delayed
**Solution:**
- Check server is running at 60Hz physics
- Verify network updates at 20Hz
- Monitor CPU usage (physics calculations)

---

## 📊 **Performance Monitoring**

### Server Performance
Monitor these metrics while testing:
- **Physics Updates**: Should be 60 FPS
- **Network Updates**: Should be 20 FPS  
- **Memory Usage**: Should be stable
- **CPU Usage**: Should be reasonable

### Network Performance
- **Input Frequency**: ~60 inputs/second during movement
- **State Updates**: 20 updates/second to clients
- **Bandwidth**: Minimal (small JSON objects)

---

## 🎯 **Success Criteria**

Your player input system is working correctly if:

✅ **Movement System:**
- WASD keys move player smoothly
- Diagonal movement is normalized
- Speed modifiers work (sneak 0.5x, walk 1x, run 1.5x)
- Player stops when no keys pressed

✅ **Rotation System:**
- Player faces mouse cursor
- Rotation updates in real-time
- Angles are calculated correctly

✅ **Physics Integration:**
- Matter.js physics bodies created
- Position updates from physics
- Boundary clamping works
- No physics errors in console

✅ **Network System:**
- Multiple clients can connect
- Input events processed correctly
- Game state broadcast to all clients
- Input validation prevents cheating

✅ **Performance:**
- 60Hz physics updates
- 20Hz network updates
- Smooth movement without stuttering
- No memory leaks or crashes

---

## 🔄 **Development Workflow**

1. **Make Code Changes** → Edit `src/systems/GameStateSystem.ts`
2. **Server Auto-Restart** → Nodemon detects changes
3. **Test with HTML Client** → Quick visual verification
4. **Run Automated Tests** → Comprehensive validation
5. **Test with Frontend** → Real-world integration
6. **Repeat** → Iterate until perfect

---

## 📝 **Additional Notes**

- Test files are temporary and can be deleted after testing
- Server logs provide detailed debugging information
- Use browser dev tools to inspect WebSocket traffic
- Matter.js physics can be visualized with debug renderer if needed

**Happy Testing! 🎮** 