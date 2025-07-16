"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateSliceIndex = calculateSliceIndex;
exports.getSliceDimension = getSliceDimension;
exports.getSlicePosition = getSlicePosition;
exports.getSliceBoundaryPosition = getSliceBoundaryPosition;
exports.isPointInSlice = isPointInSlice;
exports.determineWallOrientation = determineWallOrientation;
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
