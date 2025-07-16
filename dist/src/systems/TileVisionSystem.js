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
    partialWalls = new Map();
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
        console.log(`TileVisionSystem initialized: ${this.mapWidthTiles}x${this.mapHeightTiles} tiles, vision radius: ${this.MAX_VISION_TILES} tiles`);
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
        console.log(`Initialized ${this.wallTileIndices.size} wall tiles`);
    }
    onWallDestroyed(wallX, wallY, sliceIndex) {
        const tileX = Math.floor(wallX / this.TILE_SIZE);
        const tileY = Math.floor(wallY / this.TILE_SIZE);
        const tileIndex = this.tileToIndex(tileX, tileY);
        // Track partial destruction
        let partial = this.partialWalls.get(tileIndex);
        if (!partial) {
            partial = { destroyedSlices: 0 };
            this.partialWalls.set(tileIndex, partial);
        }
        partial.destroyedSlices |= (1 << sliceIndex);
        // If all 5 slices are destroyed, remove the wall tile
        if (partial.destroyedSlices === 0b11111) {
            this.wallTileIndices.delete(tileIndex);
            this.partialWalls.delete(tileIndex);
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
                // Check if it's partially destroyed
                const partial = this.partialWalls.get(this.tileToIndex(x, y));
                if (partial) {
                    // Count number of destroyed slices (count set bits)
                    let destroyedCount = 0;
                    let mask = partial.destroyedSlices;
                    while (mask) {
                        destroyedCount += mask & 1;
                        mask >>= 1;
                    }
                    // Allow vision if 3 or more slices are destroyed (60% destroyed)
                    if (destroyedCount >= 3) {
                        return true; // Can see through this tile
                    }
                }
                return false; // Wall blocks vision
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
