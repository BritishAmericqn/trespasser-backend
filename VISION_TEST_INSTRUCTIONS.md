# 👁️ Vision System Testing Instructions

## 🚀 Quick Start

1. **Start the server**:
   ```bash
   npm start
   ```

2. **Run the vision test**:
   ```bash
   node test-vision.js
   ```

## 🎮 Test Overview

The vision test creates two players and allows you to test various visibility scenarios:

- **Player 1** (P1): The player you control
- **Player 2** (P2): A second player to test visibility

## 📋 Test Scenarios

### Test 1: Move Away (Out of Vision)
Press `1` to move P1 north, away from P2.
- **Expected**: P2 loses sight of P1 as distance increases
- **Vision indicator**: Shows `P2→P1: ❌`

### Test 2: Move Closer (Into Vision)
Press `2` to move P1 south, toward P2.
- **Expected**: Players see each other when in range
- **Vision indicator**: Shows `P1→P2: ✅` and `P2→P1: ✅`

### Test 3: Face Toward
Press `3` to turn P1 to face P2.
- **Expected**: P1 gains vision of P2 (if in range)
- **Vision indicator**: Shows `P1→P2: ✅`

### Test 4: Face Away
Press `4` to turn P1 away from P2.
- **Expected**: P1 loses vision of P2 (blind spot)
- **Vision indicator**: Shows `P1→P2: ❌`

### Test 5: Move Close Together
Press `5` to move both players close together.
- **Expected**: Both players see each other
- **Vision indicator**: Both show ✅

### Test 6: Destroy Wall Between
Press `6` to fire rockets and destroy walls.
- **Expected**: Vision through destroyed sections
- **Note**: Position players on opposite sides of a wall first

## 🔍 What to Look For

### Vision States
The test displays real-time vision status:
```
📊 STATUS:
P1 @ (240, 135) angle: 0°
P2 @ (250, 145) angle: 180°
Vision: P1→P2: ✅  P2→P1: ❌
```

### Console Messages
Watch for these key messages:
- `👁️ P1 vision: CAN SEE P2` - When P1 gains sight of P2
- `👁️ P1 vision: CANNOT SEE P2` - When P1 loses sight of P2
- `👁️ P1 sees 2 player(s) total` - Total visible players

## 🧪 Advanced Testing

### Manual Browser Testing

1. Open two browser tabs with `test-client.html`
2. Move players with WASD keys
3. Observe when other player appears/disappears
4. Test destroying walls between players

### Performance Testing

Monitor server logs for vision calculation frequency:
```
👁️ VISION <playerId>: 1234 pixels visible
```

Should only update when:
- Player moves >2 pixels
- Player rotates >5 degrees
- Wall is destroyed
- 100ms cache timeout

## 🐛 Debugging

### Enable Debug Mode
Add to server code for detailed vision logs:
```javascript
// In VisionSystem constructor
this.debugMode = true;
```

### Common Issues

1. **Players always visible**: Check if filtering is applied in GameRoom
2. **Players never visible**: Verify vision calculation and ranges
3. **Laggy updates**: Check cache invalidation logic
4. **Wall blocking broken**: Verify destruction mask checking

## 📊 Expected Results

### Visibility Ranges
- **Forward vision**: 100px in 120° cone
- **Peripheral**: 30px radius (except 90° behind)
- **Mouse extended**: 130px in mouse direction

### Update Frequency
- **Movement threshold**: 2 pixels
- **Rotation threshold**: 5 degrees
- **Cache duration**: 100ms max
- **Network rate**: 20Hz (50ms)

## 🎯 Success Criteria

✅ Players can only see others in their vision range
✅ Walls block vision appropriately
✅ Destroyed walls allow vision through
✅ Blind spot behind player works
✅ Mouse direction extends vision
✅ Performance remains smooth with 8 players 