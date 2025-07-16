# 📋 MEMO: Frontend Fixes Required for Vertical Walls & Boundary Filtering

**To:** Frontend Development Team  
**From:** Backend Team  
**Date:** December 2024  
**Re:** Urgent Rendering Fixes for Vertical Walls and Boundary Walls

---

## 🚨 **Issues Identified**

### 1. **Vertical Wall Destruction Rendering** (CRITICAL)
When vertical walls are destroyed, the frontend is rendering horizontal transparent strips instead of vertical strips. This makes vertical walls appear to have the wrong slices destroyed.

**Example:** Destroying the middle slice (index 2) of a vertical wall currently makes the middle horizontal strip transparent, when it should make the middle vertical strip transparent.

### 2. **Invisible Boundary Walls** (MEDIUM)
The backend creates 4 boundary walls outside the game area for physics collision. These should NOT be rendered but are appearing in some views.

---

## 📊 **What Backend is Sending**

### Wall State Structure
```typescript
{
  id: "wall_1",
  position: { x: 100, y: 150 },
  width: 15,
  height: 60,
  orientation: 'vertical',  // NEW FIELD! Either 'horizontal' or 'vertical'
  destructionMask: [0, 0, 1, 0, 0],  // Which slices are destroyed
  material: 'wood',
  sliceHealth: [100, 100, 0, 100, 100]
}
```

### Orientation Logic
- `orientation: 'horizontal'` → Width > Height (e.g., 60x15)
- `orientation: 'vertical'` → Height > Width (e.g., 15x60)

---

## 🔧 **Required Fixes**

### Fix 1: Respect Wall Orientation When Rendering Destruction

**Current Code (WRONG):**
```javascript
// This assumes all walls are horizontal
for (let i = 0; i < 5; i++) {
  if (wall.destructionMask[i] === 1) {
    const sliceX = wall.position.x + (i * wall.width / 5);
    // Draw transparent vertical strip
    drawTransparentArea(sliceX, wall.position.y, wall.width / 5, wall.height);
  }
}
```

**Fixed Code:**
```javascript
for (let i = 0; i < 5; i++) {
  if (wall.destructionMask[i] === 1) {
    if (wall.orientation === 'horizontal') {
      // Horizontal wall: draw vertical transparent strips
      const sliceX = wall.position.x + (i * wall.width / 5);
      drawTransparentArea(sliceX, wall.position.y, wall.width / 5, wall.height);
    } else {
      // Vertical wall: draw horizontal transparent strips
      const sliceY = wall.position.y + (i * wall.height / 5);
      drawTransparentArea(wall.position.x, sliceY, wall.width, wall.height / 5);
    }
  }
}
```

### Fix 2: Filter Out Boundary Walls

**Add this check before rendering any wall:**
```javascript
// Don't render walls outside the game boundaries
if (wall.position.x < 0 || wall.position.y < 0 || 
    wall.position.x >= GAME_WIDTH || wall.position.y >= GAME_HEIGHT) {
  continue; // Skip this wall - it's a boundary wall
}
```

---

## 📍 **Wall Layout Reference**

### Visible Walls (8 total):
- **Horizontal walls:** IDs 1, 3, 6, 8 (wider than tall)
- **Vertical walls:** IDs 2, 4, 5, 7 (taller than wide)

### Invisible Boundary Walls (4 total):
- **Top:** Position (0, -10), Size 480x10
- **Bottom:** Position (0, 270), Size 480x10  
- **Left:** Position (-10, 0), Size 10x270
- **Right:** Position (480, 0), Size 10x270

---

## 🎯 **Visual Example**

### Horizontal Wall (Slice 2 Destroyed):
```
Before:        After:
+-----+        +--+--+
|     |        |  |  |
|     |   →    |  |  |
+-----+        +--+--+
               ↑gap↑
```

### Vertical Wall (Slice 2 Destroyed):
```
Before:        After:
+--+           +--+
|  |           |  |
|  |      →    +--+ ← gap
|  |           +--+
|  |           |  |
+--+           +--+
```

---

## ✅ **Testing Checklist**

1. [ ] Shoot middle of vertical wall → Middle horizontal strip becomes transparent
2. [ ] Shoot middle of horizontal wall → Middle vertical strip becomes transparent  
3. [ ] No walls visible outside 480x270 game area
4. [ ] All 8 game walls render correctly
5. [ ] Destruction masks apply to correct orientation

---

## 📞 **Questions?**

The backend is sending all necessary data. The `orientation` field is included in every wall state update. If you need any additional information or clarification, please reach out!

**Note:** The backend has been tested and is correctly calculating slice indices based on wall orientation. The issue is purely visual/rendering. 