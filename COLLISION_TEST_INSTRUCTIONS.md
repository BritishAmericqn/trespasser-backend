# Player-Wall Collision System Testing

## 🧪 Test Setup

1. **Start the server**:
   ```bash
   npm start
   ```

2. **Run the test client**:
   ```bash
   node test-collision.js
   ```

## 🎮 Test Scenarios

The test client provides 5 automated scenarios:

### Test 1: Basic Collision
- Press `1` to move north towards wall at (200, 100)
- **Expected**: Player stops when hitting the wall
- **Look for**: `🚫 BLOCKED` or `🧱 WALL SLIDE` messages

### Test 2: Wall Sliding
- Press `2` to move diagonally into a wall
- **Expected**: Player slides along the wall edge
- **Look for**: `🧱 WALL SLIDE` messages showing slide positions

### Test 3: Corner Collision
- Press `3` to move into a corner
- **Expected**: Player stops completely (can't slide in either direction)
- **Look for**: `🚫 BLOCKED` messages

### Test 4: Return to Center
- Press `4` to auto-navigate back to center
- **Expected**: Player moves freely when not near walls
- **Look for**: Smooth position updates

### Test 5: Destruction Test
- Press `5` to destroy a wall and walk through
- **Expected**: Player can walk through destroyed wall sections
- **Look for**: `💥 Wall damaged` messages, then free movement

## 🔍 Manual Testing

You can also test with the HTML client:

1. Open `test-client.html` in a browser
2. Use WASD to move around
3. Try walking into walls from different angles
4. Press 4 for rocket launcher, click to destroy walls
5. Walk through destroyed sections

## ✅ Success Criteria

1. **Collision Detection**: Players cannot pass through intact walls
2. **Wall Sliding**: Diagonal movement slides along walls smoothly
3. **Destruction Integration**: Players can walk through destroyed wall slices
4. **Spawn Safety**: New players spawn in valid positions
5. **Performance**: No lag or jitter during collision

## 🐛 Debug Messages

Watch for these console messages:

- `🧱 WALL SLIDE`: Player sliding along a wall
- `🚫 BLOCKED`: Player completely blocked
- `🔄 SPAWN ATTEMPT`: Finding valid spawn position
- `📍 POSITION CHECK`: Periodic position updates

## ⚠️ Known Limitations

1. Boundary walls (outside game area) are ignored for collision
2. Player radius is fixed at `PLAYER_SIZE / 2` (6 pixels)
3. Wall destruction is per-slice (5 slices per wall) 