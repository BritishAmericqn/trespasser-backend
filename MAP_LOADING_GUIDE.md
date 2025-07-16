# Map Loading Guide

## Environment Variable Setup

To load a custom map, set the `MAP_FILE` environment variable to your map filename **without the .png extension**.

### In .env File
```env
MAP_FILE=yourmap
```

### Command Line
```bash
MAP_FILE=yourmap npm start
```

### Examples
```bash
# Loads maps/level1.png
MAP_FILE=level1 npm start

# Loads maps/arena2.png  
MAP_FILE=arena2 npm start

# Loads maps/testmap.png
MAP_FILE=testmap npm start
```

## Important Notes

- ✅ Use just the filename: `MAP_FILE=yourmap`
- ❌ Don't include extension: `MAP_FILE=yourmap.png`
- ❌ Don't include path: `MAP_FILE=maps/yourmap`
- ❌ Don't include relative path: `MAP_FILE=./maps/yourmap.png`

The system automatically:
1. Adds `.png` extension
2. Looks in the `maps/` directory
3. Constructs full path as `./maps/${MAP_FILE}.png`

## File Requirements

Your map file must be:
- Exactly 480x270 pixels
- PNG format
- Located in the `maps/` directory
- Use the correct color palette (see maps/README.md) 