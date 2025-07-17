# Map Creation Guide

## Overview
Maps are created as 48x27 PNG images where each pixel represents a 10x10 game unit cell.

## Color Palette

### Wall Materials
- **Gray** `#808080` - Concrete walls (high health)
- **Brown** `#8B4513` - Wood walls (medium health)
- **Dark Gray** `#404040` - Metal walls (very high health)
- **Light Blue** `#87CEEB` - Glass walls (low health, see-through when damaged)

### Game Objects
- **Red** `#FF0000` - Red team spawn point
- **Blue** `#0000FF` - Blue team spawn point
- **Yellow** `#FFFF00` - Light source (placeholder for future lighting system)

### Empty Space
- **White** `#FFFFFF` - Empty walkable space
- **Black** `#000000` - Alternative empty space

## How It Works

1. Each pixel in the 48x27 image represents one cell (10x10 game units)
2. The smart wall detection algorithm analyzes patterns to create optimal walls
3. L-shapes and T-shapes are automatically split into appropriate horizontal/vertical walls
4. **Partial Wall System**: All walls maintain exactly 5 slices for consistency
   - Walls shorter than 5 tiles have unused slices pre-destroyed
   - Example: A 2-tile wall has slices 0-1 intact, slices 2-4 destroyed
   - This prevents visual stretching while maintaining uniform destruction mechanics
5. Adjacent wall cells of the same material are intelligently merged
6. Walls automatically get 1-5 destructible slices based on their length

## Creating Maps

1. Create a new 48x27 PNG image
2. Use the exact colors from the palette above
3. Draw walls pixel by pixel - each pixel = one 10x10 game cell
4. Place spawn points as single pixels
5. Save as `mapname.png` in this directory

## Loading Maps

```bash
# Load a specific map
MAP_FILE=warehouse npm start

# Or use the default test walls
npm start
```

## Tips

- Use a pixel art editor with grid overlay (Aseprite, GraphicsGale)
- Zoom in significantly (800-1600%) while drawing
- Keep a reference window at 100% to see actual scale
- **Wall Length Limit**: Walls are automatically limited to 5 tiles maximum to prevent slice stretching
  - Each wall has exactly 5 destructible slices
  - Longer walls would make each slice wider than 1 tile, creating visual stretching
  - Long lines will be automatically broken into multiple 5-tile walls
- The algorithm intelligently handles L-shapes and T-shapes:
  - Horizontal-dominant L-shapes become horizontal wall + vertical wall
  - Vertical-dominant L-shapes become vertical wall + horizontal wall
  - T-shapes are split at natural junction points
- Single pixels become vertical walls (pillars)
- The game automatically adds boundary walls, so you don't need to draw them

## Example Layout (actual size = 48x27 pixels)

```
████████████████████████████████████████████████
█                                              █
█  █████  ██████                               █
█     █        █                               █
█  ████  █  ██ █                               █
█     █  █   █ █                               █
█                                              █
████████████████████████████████████████████████
```

Note: In your image editor, this would be just 48x27 pixels! 