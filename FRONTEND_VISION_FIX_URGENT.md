# 🚨 URGENT: Frontend Must Use Backend Vision Data

## The Critical Issue

Your fog of war is not working because the frontend is:
1. Drawing its own large vision cone (looks like 200+ pixel radius)
2. NOT using the backend's `vision.visiblePixels` data
3. This is why you can see through ALL walls!

## Immediate Fix Required

### 1. Check Your game:state Handler

```javascript
socket.on('game:state', (state) => {
  console.log('Vision data:', state.vision); // ADD THIS
  // Should log: { visiblePixels: Array(2800+), viewAngle: ..., position: ... }
});
```

### 2. STOP Drawing Your Own Vision

Remove any code like:
```javascript
// ❌ DELETE THIS
drawVisionCone(player.x, player.y, 200); // Too big!
drawCircle(player.x, player.y, visionRadius); // Wrong!
```

### 3. USE Backend's visiblePixels

```javascript
// ✅ ONLY draw pixels the backend says are visible
function updateFog(visiblePixels) {
  // Clear fog to black
  fogContext.fillStyle = 'black';
  fogContext.fillRect(0, 0, 480, 270);
  
  // Only reveal pixels in the array
  fogContext.fillStyle = 'transparent';
  for (const pixel of visiblePixels) {
    const [x, y] = pixel.split(',').map(Number);
    fogContext.clearRect(x, y, 1, 1); // Clear 1x1 pixel
  }
}
```

## Backend Vision Characteristics
- **Range**: ~100 pixels (not 200+!)
- **Update rate**: Every 50ms
- **Wall blocking**: Working correctly
- **Data format**: Array of "x,y" strings

## Test This NOW
1. Open browser console
2. Check if `state.vision` exists
3. Log `state.vision.visiblePixels.length` - should be 2000-9000
4. If it's undefined, the frontend might be on old code! 