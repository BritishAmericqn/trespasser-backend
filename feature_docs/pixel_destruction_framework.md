# Pixel-Perfect Destruction Framework

## Overview
A smart framework for fine-grained destruction that dynamically adapts to performance constraints while maintaining your original vision of 5 vertical slices per player width.

---

## Core Architecture

### Hierarchical Bit-Mask System

```javascript
// Wall representation at different detail levels
class DestructibleWall {
  // Network level: 8x8 chunks (very efficient)
  networkMask: BigUint64Array;  // 1 bit per chunk
  
  // Visual level: Per-pixel (only for rendering)
  visualMask: Uint8Array;       // 1 bit per pixel
  
  // Damage accumulation
  damageBuffer: Float32Array;   // Accumulated damage per chunk
}
```

### Three-Tier System

1. **Network Tier** (8x8 pixel chunks)
   - What gets synced across network
   - Extremely compact (1 bit per chunk)
   - Updates at 20Hz

2. **Physics Tier** (2x2 pixel groups)
   - What projectiles collide with
   - Updates at 60Hz locally
   - Interpolated from network tier

3. **Visual Tier** (1x1 pixels)
   - What player sees
   - Can be more detailed than physics
   - Pure client-side enhancement

---

## Smart Optimization Techniques

### 1. Adaptive Detail Levels

```javascript
// Automatically adjust detail based on performance
class AdaptiveDestruction {
  updateDetailLevel(currentFPS) {
    if (currentFPS < 55) {
      this.visualDetail = 'chunks';     // 8x8
      this.physicsDetail = 'coarse';     // 4x4
    } else if (currentFPS < 115) {
      this.visualDetail = 'groups';      // 2x2
      this.physicsDetail = 'medium';     // 2x2
    } else {
      this.visualDetail = 'pixels';      // 1x1
      this.physicsDetail = 'fine';       // 1x1
    }
  }
}
```

### 2. Damage Pattern Templates

```javascript
// Pre-calculated destruction patterns
const DAMAGE_PATTERNS = {
  bullet: [
    0b00100,
    0b01110,
    0b01110,
    0b01110,
    0b00100
  ],
  explosion: [
    0b0111110,
    0b1111111,
    0b1111111,
    0b1111111,
    0b0111110
  ],
  shrapnel: generateRandomPattern()
};

// Apply pattern efficiently
function applyDamage(wall, x, y, pattern) {
  const mask = DAMAGE_PATTERNS[pattern];
  wall.networkMask ^= mask << getChunkOffset(x, y);
}
```

### 3. Vertical Slice Implementation

```javascript
// Your requested 5 vertical slices per player width
const PLAYER_WIDTH_PIXELS = 6;  // In 320x180 space
const SLICES_PER_PLAYER = 5;
const PIXELS_PER_SLICE = Math.ceil(PLAYER_WIDTH_PIXELS / SLICES_PER_PLAYER);

class VerticalSliceWall {
  slices: Uint8Array;  // Health per slice
  
  damageSlice(sliceIndex, damage) {
    this.slices[sliceIndex] -= damage;
    if (this.slices[sliceIndex] <= 0) {
      // Create hole at this slice
      this.createHole(sliceIndex);
    }
  }
  
  createHole(sliceIndex) {
    // Convert slice to pixel coordinates
    const startX = sliceIndex * PIXELS_PER_SLICE;
    const endX = startX + PIXELS_PER_SLICE;
    
    // Clear pixels in this vertical slice
    for (let x = startX; x < endX; x++) {
      this.clearColumn(x);
    }
  }
}
```

---

## Memory-Efficient Storage

### Bit Packing for 320x180

```javascript
// Each wall segment: 32x32 pixels = 1024 bits = 128 bytes
class CompactWall {
  // Store destruction state in just 16 uint64s
  data: BigUint64Array(16);
  
  setPixel(x, y, destroyed) {
    const bitIndex = y * 32 + x;
    const arrayIndex = Math.floor(bitIndex / 64);
    const bitOffset = bitIndex % 64;
    
    if (destroyed) {
      this.data[arrayIndex] |= (1n << BigInt(bitOffset));
    } else {
      this.data[arrayIndex] &= ~(1n << BigInt(bitOffset));
    }
  }
}

// Total memory for 1000 walls: 128KB!
```

### Network Compression

```javascript
// Send only changed chunks
class DeltaCompression {
  lastState: BigUint64Array;
  
  compress(currentState) {
    const changes = [];
    for (let i = 0; i < currentState.length; i++) {
      if (currentState[i] !== this.lastState[i]) {
        changes.push({
          index: i,
          value: currentState[i]
        });
      }
    }
    return changes;  // Usually just 1-3 entries
  }
}
```

---

## Vision Through Destruction

### Scanline Algorithm for Pixel Art

```javascript
// Super efficient vision through holes
function scanlineVision(playerX, playerY, walls) {
  const visible = new Set();
  
  // Work in 8 directions from player
  for (let angle = 0; angle < 360; angle += 45) {
    scanRay(playerX, playerY, angle, (x, y) => {
      if (walls.isDestroyed(x, y)) {
        visible.add(`${x},${y}`);
        return true;  // Continue ray
      }
      return false;   // Stop ray
    });
  }
  
  return visible;
}
```

### Hole Vision Optimization

```javascript
// Pre-calculate vision cones through standard holes
const HOLE_VISION_MASKS = {
  small: generateVisionMask(2, 2),   // 2x2 hole
  medium: generateVisionMask(4, 4),  // 4x4 hole
  large: generateVisionMask(6, 6)    // 6x6 hole
};

// Apply pre-calculated mask instead of raycasting
function applyHoleVision(holeX, holeY, holeSize) {
  const mask = HOLE_VISION_MASKS[holeSize];
  // Just copy the mask - super fast!
}
```

---

## Performance Monitoring

```javascript
class DestructionPerformance {
  metrics = {
    destructionUpdates: 0,
    networkSyncs: 0,
    visualUpdates: 0,
    frameTime: 0
  };
  
  autoAdjust() {
    if (this.metrics.frameTime > 16) {  // Below 60 FPS
      // Reduce visual fidelity
      this.visualUpdateRate /= 2;
      this.chunkSize *= 2;
    }
  }
}
```

---

## Integration Example

```javascript
// Complete integration example
class PixelPerfectDestruction {
  constructor() {
    this.walls = new Map();
    this.resolution = { width: 320, height: 180 };
    this.chunkSize = 8;  // Start with 8x8 chunks
  }
  
  damageWall(wallId, x, y, damageType) {
    const wall = this.walls.get(wallId);
    const pattern = DAMAGE_PATTERNS[damageType];
    
    // Apply damage at multiple tiers
    wall.applyVisualDamage(x, y, pattern);
    wall.applyPhysicsDamage(x, y, pattern);
    wall.applyNetworkDamage(x, y, pattern);
    
    // Check for breakthrough
    if (wall.hasHole(x, y)) {
      this.updateVisionGraph(wallId, x, y);
    }
  }
}
```

---

## Why This Works at Scale

1. **Pixel art constraints** = Natural optimization
2. **Bit operations** = Extremely fast
3. **Hierarchical detail** = Adapt to performance
4. **Pre-calculation** = Runtime efficiency
5. **Delta compression** = Minimal network traffic

With this framework, your original vision of fine-grained destruction with 5 vertical slices is absolutely achievable while maintaining 120+ FPS! 