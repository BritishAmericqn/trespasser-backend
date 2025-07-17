"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateSliceIndex = calculateSliceIndex;
exports.getSliceDimension = getSliceDimension;
exports.getSlicePosition = getSlicePosition;
exports.getSliceBoundaryPosition = getSliceBoundaryPosition;
exports.isPointInSlice = isPointInSlice;
exports.determineWallOrientation = determineWallOrientation;
exports.isHardWall = isHardWall;
exports.shouldAllowVisionThrough = shouldAllowVisionThrough;
exports.shouldSliceBlockVision = shouldSliceBlockVision;
exports.shouldSliceAllowVision = shouldSliceAllowVision;
exports.shouldSliceBlockVisionByHealth = shouldSliceBlockVisionByHealth;
const constants_1 = require("../../shared/constants");
/**
 * Calculate which slice a point hits on a wall
 * For horizontal walls: divides by width (left to right, 0-4)
 * For vertical walls: divides by height (top to bottom, 0-4)
 */
function calculateSliceIndex(wall, point) {
    if (wall.orientation === 'horizontal') {
        const sliceWidth = wall.width / constants_1.GAME_CONFIG.DESTRUCTION.WALL_SLICES;
        const relativeX = point.x - wall.position.x;
        const sliceIndex = Math.floor(relativeX / sliceWidth);
        return Math.max(0, Math.min(constants_1.GAME_CONFIG.DESTRUCTION.WALL_SLICES - 1, sliceIndex));
    }
    else {
        // Vertical wall - divide by height
        const sliceHeight = wall.height / constants_1.GAME_CONFIG.DESTRUCTION.WALL_SLICES;
        const relativeY = point.y - wall.position.y;
        const sliceIndex = Math.floor(relativeY / sliceHeight);
        return Math.max(0, Math.min(constants_1.GAME_CONFIG.DESTRUCTION.WALL_SLICES - 1, sliceIndex));
    }
}
/**
 * Get the dimension of a single slice
 */
function getSliceDimension(wall) {
    return wall.orientation === 'horizontal'
        ? wall.width / constants_1.GAME_CONFIG.DESTRUCTION.WALL_SLICES
        : wall.height / constants_1.GAME_CONFIG.DESTRUCTION.WALL_SLICES;
}
/**
 * Get the center position of a specific slice
 */
function getSlicePosition(wall, sliceIndex) {
    const sliceDimension = getSliceDimension(wall);
    if (wall.orientation === 'horizontal') {
        return {
            x: wall.position.x + (sliceIndex * sliceDimension) + (sliceDimension / 2),
            y: wall.position.y + (wall.height / 2)
        };
    }
    else {
        return {
            x: wall.position.x + (wall.width / 2),
            y: wall.position.y + (sliceIndex * sliceDimension) + (sliceDimension / 2)
        };
    }
}
/**
 * Get the boundary position between two slices
 * For horizontal walls: returns X coordinate
 * For vertical walls: returns Y coordinate
 */
function getSliceBoundaryPosition(wall, boundaryIndex) {
    const sliceDimension = getSliceDimension(wall);
    if (wall.orientation === 'horizontal') {
        return wall.position.x + boundaryIndex * sliceDimension;
    }
    else {
        return wall.position.y + boundaryIndex * sliceDimension;
    }
}
/**
 * Check if a point is within a specific slice's bounds
 */
function isPointInSlice(wall, point, sliceIndex) {
    const sliceDimension = getSliceDimension(wall);
    if (wall.orientation === 'horizontal') {
        const sliceLeft = wall.position.x + (sliceIndex * sliceDimension);
        const sliceRight = sliceLeft + sliceDimension;
        return (point.x >= sliceLeft &&
            point.x <= sliceRight &&
            point.y >= wall.position.y &&
            point.y <= wall.position.y + wall.height);
    }
    else {
        const sliceTop = wall.position.y + (sliceIndex * sliceDimension);
        const sliceBottom = sliceTop + sliceDimension;
        return (point.x >= wall.position.x &&
            point.x <= wall.position.x + wall.width &&
            point.y >= sliceTop &&
            point.y <= sliceBottom);
    }
}
/**
 * Determine wall orientation based on dimensions
 */
function determineWallOrientation(width, height) {
    return width > height ? 'horizontal' : 'vertical';
}
/**
 * Classify a wall as hard or soft based on its material
 * Hard walls: concrete, metal - require full destruction to see through
 * Soft walls: wood, glass - allow vision with partial destruction
 */
function isHardWall(material) {
    return material === 'concrete' || material === 'metal';
}
/**
 * Check if a wall should allow vision through based on material and destruction state
 * @param wall The wall to check
 * @param destroyedSlices Bitmask of destroyed slices (0b11111 = all destroyed)
 * @returns true if vision should pass through this wall
 */
function shouldAllowVisionThrough(wall, destroyedSlices) {
    if (isHardWall(wall.material)) {
        // Hard walls: only allow vision when ALL slices are destroyed
        return destroyedSlices === 0b11111; // All 5 slices destroyed
    }
    else {
        // Soft walls: require higher threshold (3+ slices destroyed instead of just 1)
        let destroyedCount = 0;
        let mask = destroyedSlices;
        while (mask) {
            destroyedCount += mask & 1;
            mask >>= 1;
        }
        return destroyedCount >= 3; // At least 3 out of 5 slices destroyed
    }
}
/**
 * Check if a specific slice in a wall should block vision
 * @param wall The wall to check
 * @param sliceIndex The specific slice index (0-4)
 * @param destroyedSlices Bitmask of destroyed slices
 * @returns true if this slice should block vision
 */
function shouldSliceBlockVision(wall, sliceIndex, destroyedSlices) {
    const sliceDestroyed = (destroyedSlices & (1 << sliceIndex)) !== 0;
    if (isHardWall(wall.material)) {
        // Hard walls: individual slices always block unless ALL slices are destroyed
        return destroyedSlices !== 0b11111;
    }
    else {
        // Soft walls: this slice blocks if it's intact AND we haven't reached the threshold
        if (sliceDestroyed) {
            return false; // This specific slice is destroyed, so it doesn't block
        }
        // Check if we've reached the soft wall threshold
        let destroyedCount = 0;
        let mask = destroyedSlices;
        while (mask) {
            destroyedCount += mask & 1;
            mask >>= 1;
        }
        // If we have 3+ destroyed slices, even intact slices don't block (wall is "open enough")
        return destroyedCount < 3;
    }
}
/**
 * Check if an individual slice should allow vision through based on its health and material
 * @param material The wall material ('concrete', 'wood', 'metal', 'glass')
 * @param sliceHealth Current health of the slice
 * @param maxHealth Maximum health of the slice
 * @returns true if vision should pass through this slice
 */
function shouldSliceAllowVision(material, sliceHealth, maxHealth) {
    if (isHardWall(material)) {
        // Hard walls (concrete/metal): only allow vision when slice is completely destroyed
        return sliceHealth <= 0;
    }
    else {
        // Soft walls (wood/glass): allow vision when slice is at 50% health or less
        const healthPercentage = sliceHealth / maxHealth;
        return healthPercentage <= 0.5; // 50% or less health remaining
    }
}
/**
 * Check if a specific slice in a wall should block vision based on actual health values
 * @param wall The wall to check
 * @param sliceIndex The specific slice index (0-4)
 * @returns true if this slice should block vision
 */
function shouldSliceBlockVisionByHealth(wall, sliceIndex) {
    if (sliceIndex < 0 || sliceIndex >= wall.sliceHealth.length) {
        return true; // Invalid slice index blocks vision
    }
    const sliceHealth = wall.sliceHealth[sliceIndex];
    const maxHealth = wall.maxHealth;
    // Return the opposite of shouldSliceAllowVision
    return !shouldSliceAllowVision(wall.material, sliceHealth, maxHealth);
}
