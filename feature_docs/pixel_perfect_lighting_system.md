# Pixel-Perfect Sharp Lighting System

## Vision: Raytraced Quality at Pixel Resolution

You want lighting that looks like a pixelated screenshot of a modern RTX game - stark shadows, clean light boundaries, high contrast, no soft gradients. This is absolutely achievable and will look stunning.

---

## Visual References & Inspiration

### Games with Similar Aesthetic:
- **Noita**: Per-pixel lighting and shadows
- **Dead Cells**: Sharp dynamic lighting with hard shadows  
- **Katana ZERO**: High contrast, stark lighting
- **Hyper Light Drifter**: Clean light shapes
- **Below**: Dramatic hard shadows

### The Look You're After:
- **Metro Exodus RTX** → but at 480x270
- **Control with raytracing** → but pixelated
- **Cyberpunk 2077 neon lights** → but pixel art

---

## Technical Approach

### 1. Per-Pixel Lighting (Not Chunky Blocks)

```javascript
class PixelPerfectLighting {
  // Full resolution light map at 480x270
  lightMap: Float32Array; // HDR values per pixel
  shadowMap: Uint8Array;  // Binary shadows per pixel
  
  calculateLighting(x, y) {
    // Direct illumination
    let light = ambientLight;
    
    // For each light source
    for (const source of lightSources) {
      if (this.hasLineOfSight(x, y, source)) {
        // Hard cutoff, no gradients
        const distance = this.distance(x, y, source);
        const intensity = source.power / (distance * distance);
        light += intensity;
      }
    }
    
    // Quantize to create stark boundaries
    return this.quantizeLight(light);
  }
}
```

### 2. Hard Shadow Casting

```javascript
class SharpShadows {
  // Binary shadow map - in shadow or not
  castShadow(lightX, lightY) {
    // Use Bresenham line algorithm for pixel-perfect rays
    for (let y = 0; y < 270; y++) {
      for (let x = 0; x < 480; x++) {
        const blocked = this.bresenhamRay(lightX, lightY, x, y);
        this.shadowMap[y * 480 + x] = blocked ? 0 : 1;
      }
    }
  }
  
  // Perfect pixel line - no anti-aliasing
  bresenhamRay(x0, y0, x1, y1) {
    // Check each pixel along the line
    // Return true if any wall pixel blocks
  }
}
```

### 3. Light Types for Sharp Effects

#### Point Lights (Muzzle Flash, Explosions)
```javascript
// Hard circle with no falloff gradient
const pointLight = {
  render(x, y, radius) {
    for (let py = y - radius; py <= y + radius; py++) {
      for (let px = x - radius; px <= x + radius; px++) {
        const dist = distance(x, y, px, py);
        // Hard cutoff - no gradient
        if (dist <= radius && !blocked(x, y, px, py)) {
          setPixel(px, py, FULL_BRIGHT);
        }
      }
    }
  }
};
```

#### Directional Lights (Flashlights, Lasers)
```javascript
// Sharp cone with perfect edges
const spotLight = {
  render(x, y, angle, spread, length) {
    // Cast rays within cone
    for (let a = angle - spread; a <= angle + spread; a += 0.5) {
      this.castRay(x, y, a, length);
    }
  }
};
```

---

## Performance Optimization for Per-Pixel

### 1. Simplified Raytracing at Low Res

```javascript
class PixelRaytracer {
  // Only 129,600 pixels to trace!
  trace() {
    // Primary rays only (no bounces initially)
    for (let y = 0; y < 270; y++) {
      for (let x = 0; x < 480; x++) {
        this.lightmap[y][x] = this.tracePixel(x, y);
      }
    }
  }
  
  tracePixel(x, y) {
    let light = 0;
    // Check each light source
    for (const source of lights) {
      if (this.canSee(x, y, source)) {
        light += source.contribution(x, y);
      }
    }
    // Quantize for sharp boundaries
    return light > 0.5 ? 1.0 : 0.0;
  }
}
```

### 2. Performance Analysis

**At 480x270 with 8 players:**
- **Pixels to calculate**: 129,600
- **With 16 light sources**: ~2M ray checks per frame
- **Modern CPU**: Can handle 10M+ checks per frame
- **Verdict**: Absolutely doable at 60+ FPS

**Optimization Strategies:**
- Pre-calculate static shadows
- Only update dynamic lights
- Use spatial hashing for ray checks
- Multi-thread if needed (workers)

---

## Visual Effects Arsenal

### 1. Stark Shadows
- **Hard Edges**: No penumbra, just umbra
- **High Contrast**: Full black shadows
- **Dynamic**: Update in real-time as walls break
- **Multiple Sources**: Overlapping sharp shadows

### 2. Neon/Emission Effects
```javascript
// Glowing materials that cast light
const emissiveMaterial = {
  color: [255, 0, 128], // Hot pink neon
  intensity: 2.0,
  radius: 32,
  
  // Creates sharp light pools
  illuminate() {
    // Hard-edged glow, no falloff
  }
};
```

### 3. Volumetric-Style Effects (Faked)
```javascript
// God rays through holes in walls
const godRays = {
  render(holeX, holeY, angle) {
    // Cast parallel rays through hole
    // Creates dramatic light shafts
    // Still pixel-perfect and sharp
  }
};
```

---

## Implementation Strategy

### Phase 1: Basic Sharp Lighting
- Single light source
- Hard shadows using raycasting
- Binary light/dark pixels
- 1-bit shadow map

### Phase 2: Multiple Lights
- Point lights from muzzle flashes
- Overlapping shadow regions
- Light priority system
- Additive blending (clamped)

### Phase 3: Advanced Effects
- Colored lights (neon aesthetic)
- Emissive materials
- Light shafts through holes
- Flickering/animated lights

### Phase 4: Optimization
- Shadow caching
- Dirty rectangle updates
- Spatial acceleration
- GPU compute shaders (if needed)

---

## Aesthetic Guidelines

### Do's for Sharp Pixel Lighting:
- ✅ Hard shadow boundaries
- ✅ High contrast (0% or 100% lit)
- ✅ Clean geometric light shapes
- ✅ Consistent light behavior
- ✅ Dramatic single-source shadows

### Don'ts:
- ❌ Soft gradients
- ❌ Fuzzy shadow edges  
- ❌ Ambient occlusion
- ❌ Smooth falloff curves
- ❌ Dithered lighting

---

## Technical Feasibility

### CPU Budget for Per-Pixel Lighting:
```
480x270 = 129,600 pixels

Per pixel per frame:
- 5-10 light source checks
- 1 shadow ray per light
- Total: ~1.3M operations

Modern CPU: 3GHz = 50M operations per frame at 60FPS
Lighting budget: ~2.6% of CPU 

Conclusion: EASILY ACHIEVABLE
```

### With 8 Players + All Features:
- Movement/Network: 20%
- Destruction: 10%
- Per-pixel lighting: 15% (generous)
- Vision: 5%
- Sound: 10%
- Particles: 10%
- **Total: 70%** (30% headroom)

---

## Why This Will Look Amazing

### 1. Unique Aesthetic
Very few pixel art games do true per-pixel hard shadows. You'll stand out.

### 2. Gameplay Integration
- Shadows reveal enemy positions
- Light sources become tactical
- Destruction changes lighting dramatically
- Muzzle flashes have real impact

### 3. Modern-Retro Fusion
- Raytraced quality lighting
- Pixel art constraints
- Best of both worlds

---

## Code Example: Simple Implementation

```javascript
class SharpPixelLighting {
  constructor() {
    this.width = 480;
    this.height = 270;
    this.lightmap = new Uint8Array(this.width * this.height);
  }
  
  renderLighting() {
    // Clear to dark
    this.lightmap.fill(0);
    
    // For each light source
    for (const light of this.lights) {
      this.castLight(light);
    }
    
    // Apply to render
    this.applyLightmap();
  }
  
  castLight(light) {
    // Cast rays in 360 degrees
    for (let angle = 0; angle < 360; angle += 1) {
      this.castRay(light.x, light.y, angle, light.radius);
    }
  }
  
  castRay(x, y, angle, maxDist) {
    const dx = Math.cos(angle * Math.PI / 180);
    const dy = Math.sin(angle * Math.PI / 180);
    
    for (let dist = 0; dist < maxDist; dist++) {
      const px = Math.floor(x + dx * dist);
      const py = Math.floor(y + dy * dist);
      
      if (this.isWall(px, py)) break;
      
      // Hard lighting - no falloff
      this.lightmap[py * this.width + px] = 255;
    }
  }
}
```

---

## Conclusion

Your vision of sharp, raytraced-quality lighting at pixel resolution is:
1. **Technically feasible** - Even per-pixel calculations work at 480x270
2. **Aesthetically unique** - Few games achieve this look
3. **Gameplay enhancing** - Shadows and light become tactical elements
4. **Performance friendly** - Still leaves CPU headroom

The stark, defined shadows and clean lights you want will create a striking visual style that enhances the destruction and vision mechanics. This isn't just possible - it's going to look incredible.

**Go for it!** The performance is there, the technique is proven, and the result will be visually stunning. 