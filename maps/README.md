# Map Creation Guide

## Overview
Maps are created as 480x270 PNG images that are automatically converted to game walls.

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

1. The 480x270 image is divided into a 48x27 grid (10x10 pixels per cell)
2. Each cell is read and converted based on its color
3. Adjacent wall cells of the same material are merged into single walls
4. Walls automatically get 1-5 destructible slices based on their length

## Creating Maps

1. Create a new 480x270 PNG image
2. Use the exact colors from the palette above
3. Draw walls as continuous lines (horizontal or vertical)
4. Place spawn points as single 10x10 blocks
5. Save as `mapname.png` in this directory

## Loading Maps

```bash
# Load a specific map
MAP_FILE=warehouse npm start

# Or use the default test walls
npm start
```

## Tips

- Keep walls aligned to the 10x10 grid for best results
- **Single cells (10x10) become vertical pillars** with 5 slices (2 pixels per slice)
- Horizontal walls require at least 2 connected cells
- For better slice dimensions, use walls that are 2+ cells long
- Horizontal walls are preferred for runs of cells
- Single isolated cells automatically become vertical walls (pillars)
- The game automatically adds boundary walls, so you don't need to draw them

## Example Layout

```
+--------------------+
|    B              |
|  ##### ######     |
|       #      #    |
| ####  #  ##  #    |
|    #  #   #  #    |
|    ####   ####    |
|                   |
|              R    |
+--------------------+

B = Blue spawn
R = Red spawn
# = Wall
``` 