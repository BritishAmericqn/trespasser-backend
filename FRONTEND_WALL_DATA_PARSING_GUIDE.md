# 📖 Frontend Wall Data Parsing & Rendering Guide

## 🎯 Overview

This document explains how to correctly parse and render walls from the backend, including the 5-slice destruction system and special cases like vertical pillars.

---

## 📊 Wall State Data Structure

Every wall in the game state has this structure:

```typescript
interface WallState {
  id: string;                    // Unique identifier (e.g., "wall_1")
  position: Vector2;             // Top-left corner {x, y}
  width: number;                 // Width in pixels
  height: number;                // Height in pixels
  orientation: 'horizontal' | 'vertical';  // Based on dimensions
  destructionMask: number[];     // 5 elements: 0=intact, 1=destroyed
  material: string;              // 'concrete', 'wood', 'metal', 'glass'
  sliceHealth: number[];         // 5 elements: current health per slice
}
```

---

## 🔄 Understanding Wall Orientation

The orientation determines how slices are divided:

- **Horizontal Wall** (`width > height`): Slices run **vertically** (dividing width)
- **Vertical Wall** (`height >= width`): Slices run **horizontally** (dividing height)

### Visual Examples:

**Horizontal Wall (60x15 pixels):**
```
+----+----+----+----+----+
|  0 |  1 |  2 |  3 |  4 |  <- Slice indices
+----+----+----+----+----+
Each slice is 12 pixels wide
```

**Vertical Wall (10x50 pixels):**
```
+--+ 0
|  |
+--+ 1
|  |
+--+ 2
|  |
+--+ 3
|  |
+--+ 4
|  |
+--+
Each slice is 10 pixels tall
```

---

## 🧩 Parsing the Destruction Mask

The `destructionMask` array has 5 elements, one per slice:
- `0` = Slice is intact (render normally)
- `1` = Slice is destroyed (render as transparent/missing)

### Calculating Slice Dimensions:

```javascript
function getSliceDimensions(wall) {
  if (wall.orientation === 'horizontal') {
    return {
      width: wall.width / 5,
      height: wall.height,
      direction: 'vertical'  // Slices run vertically
    };
  } else {
    return {
      width: wall.width,
      height: wall.height / 5,
      direction: 'horizontal'  // Slices run horizontally
    };
  }
}
```

### Rendering Destroyed Slices:

```javascript
function renderWallWithDestruction(wall, ctx) {
  const sliceDim = getSliceDimensions(wall);
  
  for (let i = 0; i < 5; i++) {
    if (wall.destructionMask[i] === 0) {  // Intact slice
      if (wall.orientation === 'horizontal') {
        // Draw vertical slice
        const x = wall.position.x + (i * sliceDim.width);
        ctx.fillRect(x, wall.position.y, sliceDim.width, sliceDim.height);
      } else {
        // Draw horizontal slice
        const y = wall.position.y + (i * sliceDim.height);
        ctx.fillRect(wall.position.x, y, sliceDim.width, sliceDim.height);
      }
    }
    // Destroyed slices (value 1) are simply not drawn
  }
}
```

---

## 🏛️ Special Case: Vertical Pillars (10x10)

Single cells in the map become **10x10 vertical walls** (pillars):
- These have 5 horizontal slices
- Each slice is only **2 pixels tall**
- They're always vertical orientation

```javascript
// Detecting pillars
function isPillar(wall) {
  return wall.width === 10 && wall.height === 10;
}

// Pillar slices (10x10 wall):
// Slice 0: y=0-1   (2px tall)
// Slice 1: y=2-3   (2px tall)
// Slice 2: y=4-5   (2px tall)
// Slice 3: y=6-7   (2px tall)
// Slice 4: y=8-9   (2px tall)
```

---

## 🎨 Complete Rendering Example

```javascript
class WallRenderer {
  renderWall(wall, context) {
    // Skip boundary walls
    if (this.isBoundaryWall(wall)) return;
    
    // Set material color
    context.fillStyle = this.getMaterialColor(wall.material);
    
    // Handle destruction
    for (let sliceIndex = 0; sliceIndex < 5; sliceIndex++) {
      if (wall.destructionMask[sliceIndex] === 1) continue; // Skip destroyed
      
      const rect = this.getSliceRect(wall, sliceIndex);
      
      // Draw intact slice
      context.fillRect(rect.x, rect.y, rect.width, rect.height);
      
      // Add damage visualization if health < 100%
      const healthPercent = wall.sliceHealth[sliceIndex] / 100;
      if (healthPercent < 1) {
        this.renderDamageOverlay(context, rect, healthPercent);
      }
    }
  }
  
  getSliceRect(wall, sliceIndex) {
    if (wall.orientation === 'horizontal') {
      const sliceWidth = wall.width / 5;
      return {
        x: wall.position.x + (sliceIndex * sliceWidth),
        y: wall.position.y,
        width: sliceWidth,
        height: wall.height
      };
    } else {
      const sliceHeight = wall.height / 5;
      return {
        x: wall.position.x,
        y: wall.position.y + (sliceIndex * sliceHeight),
        width: wall.width,
        height: sliceHeight
      };
    }
  }
  
  isBoundaryWall(wall) {
    return wall.position.x < 0 || 
           wall.position.y < 0 || 
           wall.position.x >= 480 || 
           wall.position.y >= 270;
  }
  
  getMaterialColor(material) {
    const colors = {
      'concrete': '#808080',
      'wood': '#8B4513',
      'metal': '#404040',
      'glass': '#87CEEB'
    };
    return colors[material] || '#808080';
  }
  
  renderDamageOverlay(context, rect, healthPercent) {
    // Add cracks or bullet holes based on damage
    context.globalAlpha = 1 - healthPercent;
    context.fillStyle = '#000000';
    // Draw damage pattern...
    context.globalAlpha = 1;
  }
}
```

---

## 🔍 Important Edge Cases

### 1. **Partial Slice Dimensions**
Some walls may have dimensions that don't divide evenly by 5:
```javascript
// Example: 23-pixel wide horizontal wall
// Slices: 4.6px, 4.6px, 4.6px, 4.6px, 4.6px
// Use Math.floor() and handle remainder in last slice
```

### 2. **Glass Material Transparency**
Glass walls should be semi-transparent when damaged:
```javascript
if (wall.material === 'glass' && healthPercent < 0.5) {
  context.globalAlpha = 0.3 + (healthPercent * 0.7);
}
```

### 3. **Destruction Events**
Listen for real-time destruction updates:
```javascript
socket.on('wall:damaged', (event) => {
  const wall = gameState.walls[event.wallId];
  wall.destructionMask[event.sliceIndex] = event.isDestroyed ? 1 : 0;
  wall.sliceHealth[event.sliceIndex] = event.newHealth;
});
```

---

## 📐 Hit Detection for Frontend

When checking if a bullet/projectile hits a wall:

```javascript
function checkWallHit(wall, point) {
  // First check bounding box
  if (point.x < wall.position.x || point.x > wall.position.x + wall.width ||
      point.y < wall.position.y || point.y > wall.position.y + wall.height) {
    return { hit: false };
  }
  
  // Calculate which slice was hit
  let sliceIndex;
  if (wall.orientation === 'horizontal') {
    const relativeX = point.x - wall.position.x;
    sliceIndex = Math.floor((relativeX / wall.width) * 5);
  } else {
    const relativeY = point.y - wall.position.y;
    sliceIndex = Math.floor((relativeY / wall.height) * 5);
  }
  
  // Check if slice is destroyed
  if (wall.destructionMask[sliceIndex] === 1) {
    return { hit: false }; // Pass through destroyed slice
  }
  
  return { 
    hit: true, 
    sliceIndex: Math.min(4, Math.max(0, sliceIndex))
  };
}
```

---

## 🌐 Network Events

### Incoming Events from Backend:

```typescript
// Initial game state
socket.on('game:state', (state) => {
  // state.walls is a Map converted to object
  gameState.walls = state.walls;
});

// Wall damage
socket.on('wall:damaged', (event) => {
  // event: { wallId, sliceIndex, damage, newHealth, isDestroyed }
  updateWallSlice(event);
});

// Wall fully destroyed
socket.on('wall:destroyed', (event) => {
  // event: { wallId }
  // All slices are now destroyed
});
```

### Outgoing Events to Backend:

```typescript
// When player shoots
socket.emit('weapon:fire', {
  position: playerPos,
  rotation: mouseAngle,
  weaponType: currentWeapon,
  timestamp: Date.now()
});
```

---

## ✅ Testing Checklist

1. [ ] Horizontal walls show vertical damage strips
2. [ ] Vertical walls show horizontal damage strips  
3. [ ] 10x10 pillars render with 2px slices
4. [ ] Destroyed slices allow bullets to pass through
5. [ ] Glass walls become transparent when damaged
6. [ ] No boundary walls visible outside game area
7. [ ] Slice health visualization works correctly
8. [ ] Network updates apply in real-time

---

## 🆘 Common Issues & Solutions

### Issue: Wrong slice orientation
**Solution:** Check `wall.orientation`, not dimensions directly

### Issue: Pillars look wrong
**Solution:** 10x10 walls have 2px slices - consider special rendering

### Issue: Bullets hitting destroyed slices
**Solution:** Always check `destructionMask[sliceIndex] === 1` before collision

### Issue: Walls outside game bounds visible
**Solution:** Filter walls where position < 0 or >= game dimensions

---

## 📝 Quick Reference

```javascript
// Key formulas
const sliceWidth = wall.width / 5;          // Horizontal walls
const sliceHeight = wall.height / 5;        // Vertical walls
const sliceIndex = Math.floor(relativePos / sliceDimension);
const isDestroyed = wall.destructionMask[sliceIndex] === 1;
const healthPercent = wall.sliceHealth[sliceIndex] / 100;
```

Good luck with the implementation! 🚀 