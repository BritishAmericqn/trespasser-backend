"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TileVisionSystem = void 0;
class TileVisionSystem {
    TILE_SIZE = 8; // Changed from 16 to 8 for better granularity
    MAX_VISION_PIXELS = 120;
    MAX_VISION_TILES;
    mapWidthTiles;
    mapHeightTiles;
    // Optimization caches - now using numeric indices
    wallTileIndices = new Set();
    partialWalls = new Map(); // Enhanced to store wall data
    visionCaches = new Map();
    // Update thresholds
    UPDATE_POSITION_THRESHOLD = 8; // pixels
    UPDATE_ROTATION_THRESHOLD = 0.1; // radians
    // Pre-allocated buffer for vision calculations
    tempVisibleTiles = new Set();
    constructor(mapWidth, mapHeight) {
        this.MAX_VISION_TILES = Math.ceil(this.MAX_VISION_PIXELS / this.TILE_SIZE);
        this.mapWidthTiles = Math.ceil(mapWidth / this.TILE_SIZE);
        this.mapHeightTiles = Math.ceil(mapHeight / this.TILE_SIZE);
        // console.log(`TileVisionSystem initialized: ${this.mapWidthTiles}x${this.mapHeightTiles} tiles, vision radius: ${this.MAX_VISION_TILES} tiles`);
    }
    // Convert x,y to single index
    tileToIndex(x, y) {
        return y * this.mapWidthTiles + x;
    }
    // Convert index back to x,y
    indexToTile(index) {
        return {
            x: index % this.mapWidthTiles,
            y: Math.floor(index / this.mapWidthTiles)
        };
    }
    initializeWalls(walls) {
        this.wallTileIndices.clear();
        for (const wall of walls) {
            const startX = Math.floor(wall.x / this.TILE_SIZE);
            const startY = Math.floor(wall.y / this.TILE_SIZE);
            const endX = Math.floor((wall.x + wall.width) / this.TILE_SIZE);
            const endY = Math.floor((wall.y + wall.height) / this.TILE_SIZE);
            for (let y = startY; y <= endY; y++) {
                for (let x = startX; x <= endX; x++) {
                    this.wallTileIndices.add(this.tileToIndex(x, y));
                }
            }
        }
        // console.log(`Initialized ${this.wallTileIndices.size} wall tiles`);
    }
    // Add a single wall (for interface compatibility with VisibilityPolygonSystem)
    addWall(wallId, wall) {
        // TileVisionSystem doesn't track individual walls, just tiles
        const startX = Math.floor(wall.position.x / this.TILE_SIZE);
        const startY = Math.floor(wall.position.y / this.TILE_SIZE);
        const endX = Math.floor((wall.position.x + wall.width) / this.TILE_SIZE);
        const endY = Math.floor((wall.position.y + wall.height) / this.TILE_SIZE);
        for (let y = startY; y <= endY; y++) {
            for (let x = startX; x <= endX; x++) {
                this.wallTileIndices.add(this.tileToIndex(x, y));
            }
        }
    }
    // Remove a wall (for interface compatibility with VisibilityPolygonSystem)
    removeWall(wallId) {
        // TileVisionSystem doesn't track individual walls
        // Would need wall bounds to properly remove tiles
    }
    onWallDestroyed(wallId, wall, sliceIndex) {
        // console.log(`🔍 onWallDestroyed called for ${wallId} slice ${sliceIndex}`);
        // console.log(`   Wall position: (${wall.position.x}, ${wall.position.y}) size: ${wall.width}x${wall.height}`);
        // Calculate all tiles that this wall occupies
        const startX = Math.floor(wall.position.x / this.TILE_SIZE);
        const startY = Math.floor(wall.position.y / this.TILE_SIZE);
        const endX = Math.floor((wall.position.x + wall.width) / this.TILE_SIZE);
        const endY = Math.floor((wall.position.y + wall.height) / this.TILE_SIZE);
        // console.log(`   Wall occupies tiles from (${startX},${startY}) to (${endX},${endY})`);
        // For each tile the wall occupies
        for (let y = startY; y <= endY; y++) {
            for (let x = startX; x <= endX; x++) {
                const tileIndex = this.tileToIndex(x, y);
                // Track partial destruction with full wall data
                let partial = this.partialWalls.get(tileIndex);
                if (!partial) {
                    partial = {
                        destroyedSlices: 0,
                        wallId: wallId,
                        wallPosition: { x: wall.position.x, y: wall.position.y },
                        wallWidth: wall.width,
                        wallHeight: wall.height
                    };
                    this.partialWalls.set(tileIndex, partial);
                }
                const oldMask = partial.destroyedSlices;
                partial.destroyedSlices |= (1 << sliceIndex);
                // console.log(`   Tile ${x},${y}: destroyed slices ${oldMask.toString(2)} → ${partial.destroyedSlices.toString(2)}`);
                // If all 5 slices are destroyed, remove the wall tile
                if (partial.destroyedSlices === 0b11111) {
                    this.wallTileIndices.delete(tileIndex);
                    this.partialWalls.delete(tileIndex);
                    // console.log(`✅ Wall tile ${x},${y} (index ${tileIndex}) fully destroyed and removed from vision blocking`);
                }
            }
        }
        // Invalidate all vision caches
        for (const cache of this.visionCaches.values()) {
            cache.wallsChanged = true;
        }
    }
    updatePlayerVision(player) {
        const playerId = player.id;
        // Get or create vision cache for this player
        let cache = this.visionCaches.get(playerId);
        if (!cache) {
            cache = {
                lastPlayerPos: { x: -9999, y: -9999 },
                lastPlayerRotation: 0,
                cachedVision: null,
                wallsChanged: true
            };
            this.visionCaches.set(playerId, cache);
        }
        // Check if update is needed (temporal coherence)
        if (!this.needsVisionUpdate(player, cache)) {
            return cache.cachedVision;
        }
        // Calculate new vision
        const visibleTileIndices = this.calculateVision(player);
        // Convert Set to Uint16Array for efficient transmission
        const visionArray = new Uint16Array(visibleTileIndices.size);
        let i = 0;
        for (const index of visibleTileIndices) {
            visionArray[i++] = index;
        }
        // Update cache
        cache.lastPlayerPos = { x: player.transform.position.x, y: player.transform.position.y };
        cache.lastPlayerRotation = player.transform.rotation;
        cache.cachedVision = visionArray;
        cache.wallsChanged = false;
        return visionArray;
    }
    // Alternative: Raycast-based vision (more accurate for gaps)
    updatePlayerVisionRaycast(player) {
        const visibleTiles = new Set();
        const playerTileX = Math.floor(player.transform.position.x / this.TILE_SIZE);
        const playerTileY = Math.floor(player.transform.position.y / this.TILE_SIZE);
        // Cast rays in a cone
        const numRays = 60; // One ray every 2 degrees
        const halfAngle = Math.PI / 3; // 60 degrees each side
        for (let i = 0; i < numRays; i++) {
            const angle = player.transform.rotation - halfAngle + (i / numRays) * halfAngle * 2;
            // Cast ray and mark all tiles it passes through as visible
            const tilesAlongRay = this.castRay(playerTileX, playerTileY, angle, this.MAX_VISION_TILES);
            for (const tileIndex of tilesAlongRay) {
                visibleTiles.add(tileIndex);
            }
        }
        return visibleTiles;
    }
    needsVisionUpdate(player, cache) {
        const posDiff = Math.abs(player.transform.position.x - cache.lastPlayerPos.x) +
            Math.abs(player.transform.position.y - cache.lastPlayerPos.y);
        const rotDiff = Math.abs(player.transform.rotation - cache.lastPlayerRotation);
        return posDiff > this.UPDATE_POSITION_THRESHOLD ||
            rotDiff > this.UPDATE_ROTATION_THRESHOLD ||
            cache.wallsChanged;
    }
    calculateVision(player) {
        // Clear and reuse the temp set to avoid allocations
        this.tempVisibleTiles.clear();
        const playerTileX = Math.floor(player.transform.position.x / this.TILE_SIZE);
        const playerTileY = Math.floor(player.transform.position.y / this.TILE_SIZE);
        // Bounded vision box optimization
        const minX = Math.max(0, playerTileX - this.MAX_VISION_TILES);
        const maxX = Math.min(this.mapWidthTiles - 1, playerTileX + this.MAX_VISION_TILES);
        const minY = Math.max(0, playerTileY - this.MAX_VISION_TILES);
        const maxY = Math.min(this.mapHeightTiles - 1, playerTileY + this.MAX_VISION_TILES);
        // Add player's tile
        this.tempVisibleTiles.add(this.tileToIndex(playerTileX, playerTileY));
        // Check all tiles in bounded box
        for (let y = minY; y <= maxY; y++) {
            for (let x = minX; x <= maxX; x++) {
                if (this.canSeeTile(player, playerTileX, playerTileY, x, y)) {
                    this.tempVisibleTiles.add(this.tileToIndex(x, y));
                }
            }
        }
        return this.tempVisibleTiles;
    }
    canSeeTile(player, fromX, fromY, toX, toY) {
        // Early distance rejection
        const dx = toX - fromX;
        const dy = toY - fromY;
        const distSquared = dx * dx + dy * dy;
        if (distSquared > this.MAX_VISION_TILES * this.MAX_VISION_TILES) {
            return false;
        }
        // Directional culling based on player rotation
        if (!this.isInViewCone(player, fromX, fromY, toX, toY)) {
            return false;
        }
        // Bresenham's line algorithm for line-of-sight
        return this.hasLineOfSight(fromX, fromY, toX, toY);
    }
    isInViewCone(player, fromX, fromY, toX, toY) {
        const dx = toX - fromX;
        const dy = toY - fromY;
        // Player is looking at angle player.transform.rotation
        // Check if target tile is within 120 degree cone
        const angleToTile = Math.atan2(dy, dx);
        let angleDiff = angleToTile - player.transform.rotation;
        // Normalize angle difference to [-PI, PI]
        while (angleDiff > Math.PI)
            angleDiff -= 2 * Math.PI;
        while (angleDiff < -Math.PI)
            angleDiff += 2 * Math.PI;
        // 120 degrees = 2.094 radians, so ±60 degrees = ±1.047 radians
        return Math.abs(angleDiff) <= 1.047;
    }
    hasLineOfSight(x0, y0, x1, y1) {
        // Bresenham's line algorithm
        const dx = Math.abs(x1 - x0);
        const dy = Math.abs(y1 - y0);
        const sx = x0 < x1 ? 1 : -1;
        const sy = y0 < y1 ? 1 : -1;
        let err = dx - dy;
        let x = x0;
        let y = y0;
        while (true) {
            // Check if current tile blocks vision (skip the starting tile)
            if ((x !== x0 || y !== y0) && this.wallTileIndices.has(this.tileToIndex(x, y))) {
                // Check if this tile has partial wall destruction
                const tileIndex = this.tileToIndex(x, y);
                const partial = this.partialWalls.get(tileIndex);
                if (partial && partial.destroyedSlices > 0) {
                    // TEMPORARY: Allow through if ANY slice destroyed (will be replaced with individual segments)
                    // Continue - don't return false
                }
                else {
                    // Solid wall with no destroyed slices blocks vision
                    return false;
                }
            }
            if (x === x1 && y === y1)
                break;
            const e2 = 2 * err;
            if (e2 > -dy) {
                err -= dy;
                x += sx;
            }
            if (e2 < dx) {
                err += dx;
                y += sy;
            }
        }
        return true;
    }
    /**
     * Check if a ray passing through a tile intersects any destroyed slices
     * Uses simplified approach with available tile + wall data
     */
    rayPassesThroughDestroyedSlice(tileX, tileY, rayStartX, rayStartY, rayEndX, rayEndY, wallData) {
        // Convert tile coordinates to pixel coordinates for precise calculation
        const tilePixelX = tileX * this.TILE_SIZE;
        const tilePixelY = tileY * this.TILE_SIZE;
        const rayStartPixelX = rayStartX * this.TILE_SIZE + this.TILE_SIZE / 2;
        const rayStartPixelY = rayStartY * this.TILE_SIZE + this.TILE_SIZE / 2;
        const rayEndPixelX = rayEndX * this.TILE_SIZE + this.TILE_SIZE / 2;
        const rayEndPixelY = rayEndY * this.TILE_SIZE + this.TILE_SIZE / 2;
        // Calculate ray direction
        const rayDx = rayEndPixelX - rayStartPixelX;
        const rayDy = rayEndPixelY - rayStartPixelY;
        const rayLength = Math.sqrt(rayDx * rayDx + rayDy * rayDy);
        if (rayLength === 0)
            return false;
        const rayDirX = rayDx / rayLength;
        const rayDirY = rayDy / rayLength;
        // Sample points along the ray within this tile
        const samples = 8; // Test 8 points across the tile
        const tileLeft = tilePixelX;
        const tileRight = tilePixelX + this.TILE_SIZE;
        const tileTop = tilePixelY;
        const tileBottom = tilePixelY + this.TILE_SIZE;
        for (let i = 0; i <= samples; i++) {
            const t = i / samples;
            const sampleX = rayStartPixelX + t * rayDx;
            const sampleY = rayStartPixelY + t * rayDy;
            // Check if sample point is within this tile
            if (sampleX >= tileLeft && sampleX <= tileRight &&
                sampleY >= tileTop && sampleY <= tileBottom) {
                // Check if sample point is within the wall
                if (sampleX >= wallData.wallPosition.x &&
                    sampleX <= wallData.wallPosition.x + wallData.wallWidth &&
                    sampleY >= wallData.wallPosition.y &&
                    sampleY <= wallData.wallPosition.y + wallData.wallHeight) {
                    // Calculate which slice this sample point is in
                    const sliceWidth = wallData.wallWidth / 5; // WALL_SLICES = 5
                    const sliceIndex = Math.floor((sampleX - wallData.wallPosition.x) / sliceWidth);
                    const clampedSliceIndex = Math.max(0, Math.min(4, sliceIndex));
                    // Check if this slice is destroyed
                    if (wallData.destroyedSlices & (1 << clampedSliceIndex)) {
                        return true; // Ray passes through a destroyed slice
                    }
                }
            }
        }
        return false; // Ray doesn't pass through any destroyed slices in this tile
    }
    /**
     * Check if a specific position passes through a destroyed slice (for castRay method)
     */
    rayPositionPassesThroughDestroyedSlice(positionX, positionY, wallData) {
        // Convert position to pixel coordinates
        const pixelX = positionX * this.TILE_SIZE + this.TILE_SIZE / 2;
        const pixelY = positionY * this.TILE_SIZE + this.TILE_SIZE / 2;
        // Check if position is within the wall
        if (pixelX >= wallData.wallPosition.x &&
            pixelX <= wallData.wallPosition.x + wallData.wallWidth &&
            pixelY >= wallData.wallPosition.y &&
            pixelY <= wallData.wallPosition.y + wallData.wallHeight) {
            // Calculate which slice this position is in
            const sliceWidth = wallData.wallWidth / 5; // WALL_SLICES = 5
            const sliceIndex = Math.floor((pixelX - wallData.wallPosition.x) / sliceWidth);
            const clampedSliceIndex = Math.max(0, Math.min(4, sliceIndex));
            // Check if this slice is destroyed
            return (wallData.destroyedSlices & (1 << clampedSliceIndex)) !== 0;
        }
        return false; // Position not in wall
    }
    castRay(startX, startY, angle, maxDistance) {
        const tiles = [];
        const dx = Math.cos(angle);
        const dy = Math.sin(angle);
        let x = startX + 0.5; // Start from tile center
        let y = startY + 0.5;
        for (let dist = 0; dist < maxDistance; dist += 0.5) {
            const tileX = Math.floor(x);
            const tileY = Math.floor(y);
            // Check bounds
            if (tileX < 0 || tileX >= this.mapWidthTiles ||
                tileY < 0 || tileY >= this.mapHeightTiles) {
                break;
            }
            const tileIndex = this.tileToIndex(tileX, tileY);
            tiles.push(tileIndex);
            // Check if wall blocks further vision
            if (this.wallTileIndices.has(tileIndex)) {
                // Check partial destruction with slice precision
                const partial = this.partialWalls.get(tileIndex);
                if (partial && partial.destroyedSlices > 0) {
                    // Slice-aware vision: Check which slice the ray passes through
                    const rayPixelX = x * this.TILE_SIZE + this.TILE_SIZE / 2; // Convert tile coords to pixel center
                    const rayPixelY = y * this.TILE_SIZE + this.TILE_SIZE / 2;
                    // Calculate which slice this ray would pass through
                    const sliceWidth = partial.wallWidth / 5; // 5 slices per wall
                    const relativeX = rayPixelX - partial.wallPosition.x;
                    const sliceIndex = Math.floor(relativeX / sliceWidth);
                    // Check if the ray is within wall bounds and hitting a valid slice
                    if (sliceIndex >= 0 && sliceIndex < 5) {
                        // Check if this specific slice is destroyed
                        const sliceDestroyed = (partial.destroyedSlices >> sliceIndex) & 1;
                        if (sliceDestroyed) {
                            // Ray passes through destroyed slice - but check for edge collisions
                            // Check if we're about to hit a slice boundary (transition from destroyed to intact)
                            const nextX = x + dx * 0.5;
                            const nextY = y + dy * 0.5;
                            const nextPixelX = nextX * this.TILE_SIZE;
                            const nextPixelY = nextY * this.TILE_SIZE;
                            // Only check horizontal movement for vertical slice boundaries
                            if (Math.abs(dx) > 0.01) { // Ray has horizontal component
                                const nextRelativeX = nextPixelX - partial.wallPosition.x;
                                const nextSliceIndex = Math.floor(nextRelativeX / sliceWidth);
                                // Check if we're crossing into a different slice
                                if (nextSliceIndex !== sliceIndex && nextSliceIndex >= 0 && nextSliceIndex < 5) {
                                    // Check if the next slice is intact
                                    const nextSliceDestroyed = (partial.destroyedSlices >> nextSliceIndex) & 1;
                                    if (!nextSliceDestroyed) {
                                        // We're about to hit an intact slice from inside the wall - stop here
                                        break;
                                    }
                                }
                                // Also check if we're leaving the wall bounds horizontally
                                if (nextRelativeX < 0 || nextRelativeX >= partial.wallWidth) {
                                    // Check if we're inside the wall vertically
                                    if (nextPixelY >= partial.wallPosition.y &&
                                        nextPixelY <= partial.wallPosition.y + partial.wallHeight) {
                                        // We're trying to exit the wall horizontally while inside it - stop
                                        break;
                                    }
                                }
                            }
                        }
                        else {
                            // Ray hits intact slice - vision blocked
                            break;
                        }
                    }
                    else {
                        // Ray is outside wall bounds, continue
                        // This can happen at wall edges
                    }
                }
                else {
                    // Solid wall with no destroyed slices blocks vision
                    break;
                }
            }
            x += dx * 0.5;
            y += dy * 0.5;
        }
        return tiles;
    }
    removePlayer(playerId) {
        this.visionCaches.delete(playerId);
    }
    // Helper method for debugging - converts indices back to readable format
    debugIndices(indices) {
        const result = [];
        for (let i = 0; i < indices.length; i++) {
            const tile = this.indexToTile(indices[i]);
            result.push(`${tile.x},${tile.y}`);
        }
        return result;
    }
}
exports.TileVisionSystem = TileVisionSystem;
