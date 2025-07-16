"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VisibilityPolygonSystem = void 0;
const constants_1 = require("../../shared/constants");
const wallSliceHelpers_1 = require("../utils/wallSliceHelpers");
class VisibilityPolygonSystem {
    walls = new Map();
    viewAngle = (120 * Math.PI) / 180; // 120 degrees in radians
    viewDistance = 150; // Maximum view distance
    constructor() {
        console.log('VisibilityPolygonSystem initialized');
    }
    /**
     * Initialize walls from destruction system format
     */
    initializeWalls(wallData) {
        this.walls.clear();
        wallData.forEach((wall) => {
            this.walls.set(wall.id, {
                id: wall.id,
                position: { x: wall.x, y: wall.y },
                width: wall.width,
                height: wall.height,
                orientation: wall.width > wall.height ? 'horizontal' : 'vertical',
                destroyedSlices: 0
            });
        });
        console.log(`Initialized ${this.walls.size} walls for visibility polygon`);
    }
    /**
     * Add a single wall (for dynamically created walls)
     */
    addWall(wallId, wall) {
        this.walls.set(wallId, {
            id: wallId,
            position: { x: wall.position.x, y: wall.position.y },
            width: wall.width,
            height: wall.height,
            orientation: wall.width > wall.height ? 'horizontal' : 'vertical',
            destroyedSlices: 0
        });
        // console.log(`[VisibilityPolygon] Added wall ${wallId}`);
    }
    /**
     * Remove a wall (for fully destroyed walls)
     */
    removeWall(wallId) {
        if (this.walls.delete(wallId)) {
            // console.log(`[VisibilityPolygon] Removed wall ${wallId}`);
        }
    }
    /**
     * Update wall destruction state
     */
    onWallDestroyed(wallId, wall, sliceIndex) {
        const storedWall = this.walls.get(wallId);
        if (storedWall) {
            const oldMask = storedWall.destroyedSlices;
            storedWall.destroyedSlices |= (1 << sliceIndex);
            // console.log(`[VisibilityPolygon] Wall ${wallId} slice ${sliceIndex} destroyed. Mask: ${oldMask.toString(2).padStart(5, '0')} → ${storedWall.destroyedSlices.toString(2).padStart(5, '0')}`);
        }
        else {
            console.warn(`[VisibilityPolygon] Wall ${wallId} not found in visibility system!`);
        }
    }
    /**
     * Calculate visibility polygon from a given position
     */
    calculateVisibility(viewerPos, viewDirection) {
        // Step 1: Find all wall corners within range and FOV
        const corners = this.findVisibleCorners(viewerPos, viewDirection);
        // Step 2: Define view cone boundaries
        const leftBound = viewDirection - this.viewAngle / 2;
        const rightBound = viewDirection + this.viewAngle / 2;
        // Step 3: Build list of all angles to cast rays, ensuring they're within FOV
        const angles = [];
        // Always include boundaries, but normalize them
        const normalizeAngle = (angle) => {
            let normalized = angle % (2 * Math.PI);
            if (normalized > Math.PI)
                normalized -= 2 * Math.PI;
            if (normalized < -Math.PI)
                normalized += 2 * Math.PI;
            return normalized;
        };
        angles.push(normalizeAngle(leftBound));
        angles.push(normalizeAngle(rightBound));
        // Add corner angles with epsilon, but only if they're within FOV
        const epsilon = 0.0001;
        for (const corner of corners) {
            // Corner angles are already filtered to be within FOV in findVisibleCorners
            angles.push(normalizeAngle(corner.angle - epsilon));
            angles.push(normalizeAngle(corner.angle + epsilon));
        }
        // Filter out any angles that somehow ended up outside FOV
        const fovAngles = angles.filter(angle => {
            return this.isAngleInViewCone(angle, leftBound, rightBound);
        });
        // Remove duplicates and sort
        const uniqueAngles = Array.from(new Set(fovAngles));
        // Sort angles properly, handling wrap-around
        uniqueAngles.sort((a, b) => {
            // Normalize to view direction to handle wrap-around
            let relA = a - viewDirection;
            let relB = b - viewDirection;
            // Normalize to [-PI, PI]
            while (relA > Math.PI)
                relA -= 2 * Math.PI;
            while (relA < -Math.PI)
                relA += 2 * Math.PI;
            while (relB > Math.PI)
                relB -= 2 * Math.PI;
            while (relB < -Math.PI)
                relB += 2 * Math.PI;
            return relA - relB;
        });
        // Debug: Check if any angles are outside normal range
        const abnormalAngles = uniqueAngles.filter(a => a < -Math.PI || a > Math.PI);
        if (abnormalAngles.length > 0) {
            console.log(`[AngleDebug] Found angles outside [-π, π] range:`);
            abnormalAngles.forEach(a => {
                console.log(`  - ${(a * 180 / Math.PI).toFixed(1)}° (${a.toFixed(3)} rad)`);
            });
            console.log(`  - This suggests a normalization issue`);
        }
        // Step 4: Build the visibility polygon
        const visibilityPoints = [];
        const pointsOnArc = []; // Track which points are on the arc
        // Start with player position
        visibilityPoints.push({ ...viewerPos });
        pointsOnArc.push(false);
        // Cast rays and collect hit points
        for (let i = 0; i < uniqueAngles.length; i++) {
            const angle = uniqueAngles[i];
            const hitPoint = this.castRay(viewerPos, angle);
            if (hitPoint) {
                // Check if hit point is at max distance (on the arc)
                const dist = Math.hypot(hitPoint.x - viewerPos.x, hitPoint.y - viewerPos.y);
                const isOnArc = Math.abs(dist - this.viewDistance) < 0.1; // Small tolerance
                visibilityPoints.push(hitPoint);
                pointsOnArc.push(isOnArc);
            }
        }
        // The polygon will close automatically back to the first point (player position)
        // Post-process: Add arc interpolation between consecutive arc points
        const finalPoints = [];
        finalPoints.push(visibilityPoints[0]); // Start with viewer position
        for (let i = 1; i < visibilityPoints.length; i++) {
            const prevOnArc = pointsOnArc[i - 1];
            const currOnArc = pointsOnArc[i];
            if (prevOnArc && currOnArc && i > 1) { // Both points on arc (skip first point which is viewer)
                // Add interpolated arc points between them
                const prevPoint = visibilityPoints[i - 1];
                const currPoint = visibilityPoints[i];
                const prevAngle = Math.atan2(prevPoint.y - viewerPos.y, prevPoint.x - viewerPos.x);
                const currAngle = Math.atan2(currPoint.y - viewerPos.y, currPoint.x - viewerPos.x);
                let angleDiff = currAngle - prevAngle;
                // Normalize angle difference to [-π, π]
                while (angleDiff > Math.PI)
                    angleDiff -= 2 * Math.PI;
                while (angleDiff < -Math.PI)
                    angleDiff += 2 * Math.PI;
                // Only interpolate if the angular gap is significant
                const maxAngleGap = Math.PI / 18; // 10 degrees
                if (Math.abs(angleDiff) > maxAngleGap) {
                    const numInterpolated = Math.ceil(Math.abs(angleDiff) / maxAngleGap) - 1;
                    for (let j = 1; j <= numInterpolated; j++) {
                        const t = j / (numInterpolated + 1);
                        const interpAngle = prevAngle + angleDiff * t;
                        const interpPoint = {
                            x: viewerPos.x + Math.cos(interpAngle) * this.viewDistance,
                            y: viewerPos.y + Math.sin(interpAngle) * this.viewDistance
                        };
                        finalPoints.push(interpPoint);
                    }
                }
            }
            finalPoints.push(visibilityPoints[i]);
        }
        // Debug: Log basic info about the polygon (temporarily increased for testing)
        if (finalPoints.length > 10) { // Log more frequently for testing
            const arcPointCount = pointsOnArc.filter(p => p).length;
            console.log(`[VisibilityPolygon] Created polygon with ${finalPoints.length} points (${arcPointCount} original arc points), direction: ${(viewDirection * 180 / Math.PI).toFixed(1)}°`);
        }
        return finalPoints;
    }
    /**
     * Check if an angle is within the view cone
     */
    isAngleInViewCone(angle, leftBound, rightBound) {
        // Normalize angles to [0, 2π]
        const normalizeAngle = (a) => {
            let normalized = a % (2 * Math.PI);
            if (normalized < 0)
                normalized += 2 * Math.PI;
            return normalized;
        };
        const normAngle = normalizeAngle(angle);
        const normLeft = normalizeAngle(leftBound);
        const normRight = normalizeAngle(rightBound);
        // Handle wrap-around case
        if (normLeft > normRight) {
            return normAngle >= normLeft || normAngle <= normRight;
        }
        else {
            return normAngle >= normLeft && normAngle <= normRight;
        }
    }
    /**
     * Get all wall corners for visibility calculation
     * Let FOV filtering and ray casting determine actual visibility
     */
    getAllWallCorners(wall, viewerPos) {
        const corners = [];
        // Return all four corners of the wall
        corners.push({ x: wall.position.x, y: wall.position.y }); // Top-left
        corners.push({ x: wall.position.x + wall.width, y: wall.position.y }); // Top-right
        corners.push({ x: wall.position.x, y: wall.position.y + wall.height }); // Bottom-left
        corners.push({ x: wall.position.x + wall.width, y: wall.position.y + wall.height }); // Bottom-right
        // Also add corners created by destruction if the wall is partially destroyed
        if (wall.destroyedSlices !== 0 && wall.destroyedSlices !== 0b11111) {
            const sliceDimension = (0, wallSliceHelpers_1.getSliceDimension)(wall);
            let addedCorners = 0;
            // Check each boundary between slices
            for (let i = 0; i <= 5; i++) {
                const adjacentSliceIndices = wall.orientation === 'horizontal'
                    ? { first: i - 1, second: i } // left/right for horizontal
                    : { first: i - 1, second: i }; // top/bottom for vertical
                // Get destruction state of adjacent slices
                const firstDestroyed = adjacentSliceIndices.first >= 0 && adjacentSliceIndices.first < 5
                    ? (wall.destroyedSlices >> adjacentSliceIndices.first) & 1
                    : 0;
                const secondDestroyed = adjacentSliceIndices.second >= 0 && adjacentSliceIndices.second < 5
                    ? (wall.destroyedSlices >> adjacentSliceIndices.second) & 1
                    : 0;
                // Add corners where destruction state changes
                if (firstDestroyed !== secondDestroyed) {
                    const boundaryPos = (0, wallSliceHelpers_1.getSliceBoundaryPosition)(wall, i);
                    if (wall.orientation === 'horizontal') {
                        // Add both top and bottom corners at this vertical boundary
                        corners.push({ x: boundaryPos, y: wall.position.y });
                        corners.push({ x: boundaryPos, y: wall.position.y + wall.height });
                    }
                    else {
                        // Add both left and right corners at this horizontal boundary
                        corners.push({ x: wall.position.x, y: boundaryPos });
                        corners.push({ x: wall.position.x + wall.width, y: boundaryPos });
                    }
                    addedCorners += 2;
                }
            }
        }
        return corners;
    }
    /**
     * Find all wall corners that might affect visibility
     */
    findVisibleCorners(viewerPos, viewDirection) {
        const corners = [];
        const cornerMap = new Map(); // Deduplicate shared corners
        const leftBound = viewDirection - this.viewAngle / 2;
        const rightBound = viewDirection + this.viewAngle / 2;
        // Debug: Track corner collection
        let totalCornersFound = 0;
        let cornersFilteredByDistance = 0;
        let cornersFilteredByFOV = 0;
        let wallsProcessed = 0;
        let arcIntersectionsFound = 0;
        // First, collect all potential corners
        this.walls.forEach((wall) => {
            // Skip fully destroyed walls
            if (wall.destroyedSlices === 0b11111)
                return;
            wallsProcessed++;
            // Get all corners of the wall (no filtering)
            const wallCorners = this.getAllWallCorners(wall, viewerPos);
            // Also check for arc-edge intersections
            const edges = [
                { start: { x: wall.position.x, y: wall.position.y },
                    end: { x: wall.position.x + wall.width, y: wall.position.y } }, // Top
                { start: { x: wall.position.x + wall.width, y: wall.position.y },
                    end: { x: wall.position.x + wall.width, y: wall.position.y + wall.height } }, // Right
                { start: { x: wall.position.x + wall.width, y: wall.position.y + wall.height },
                    end: { x: wall.position.x, y: wall.position.y + wall.height } }, // Bottom
                { start: { x: wall.position.x, y: wall.position.y + wall.height },
                    end: { x: wall.position.x, y: wall.position.y } } // Left
            ];
            // Find arc intersections for each edge
            for (const edge of edges) {
                const arcIntersections = this.findArcEdgeIntersections(edge, viewerPos, viewDirection);
                for (const intersection of arcIntersections) {
                    wallCorners.push(intersection);
                    arcIntersectionsFound++;
                }
            }
            // Process all corners (wall corners + arc intersections)
            for (const corner of wallCorners) {
                totalCornersFound++;
                const dx = corner.x - viewerPos.x;
                const dy = corner.y - viewerPos.y;
                const distance = Math.hypot(dx, dy);
                // Skip if beyond view distance
                if (distance > this.viewDistance) {
                    cornersFilteredByDistance++;
                    continue;
                }
                // Calculate angle and check if within view cone
                let angle = Math.atan2(dy, dx);
                // Use the same wraparound-aware FOV check as isAngleInViewCone
                if (!this.isAngleInViewCone(angle, leftBound, rightBound)) {
                    cornersFilteredByFOV++;
                    continue;
                }
                // Use position as key to deduplicate shared corners
                const key = `${corner.x},${corner.y}`;
                if (!cornerMap.has(key) || cornerMap.get(key).distance > distance) {
                    cornerMap.set(key, {
                        x: corner.x,
                        y: corner.y,
                        angle: angle,
                        distance: distance,
                        wallId: wall.id
                    });
                }
            }
        });
        // Convert map to array
        const validCorners = Array.from(cornerMap.values());
        // Debug output when we have many corners or arc intersections
        if (validCorners.length > 0) { // Always log for testing
            console.log(`[CornerDebug] Visibility calculation:`);
            console.log(`  - Walls processed: ${wallsProcessed}`);
            console.log(`  - Total corners found: ${totalCornersFound}`);
            console.log(`  - Arc intersections found: ${arcIntersectionsFound}`);
            console.log(`  - Filtered by distance: ${cornersFilteredByDistance}`);
            console.log(`  - Filtered by FOV: ${cornersFilteredByFOV}`);
            console.log(`  - Final corners: ${validCorners.length}`);
            console.log(`  - Viewer at: (${viewerPos.x.toFixed(0)}, ${viewerPos.y.toFixed(0)}), looking ${(viewDirection * 180 / Math.PI).toFixed(1)}°`);
        }
        return validCorners;
    }
    /**
     * Get wall corners including those created by destruction
     */
    getWallCorners(wall) {
        const corners = [];
        // Always add outer corners
        corners.push({ x: wall.position.x, y: wall.position.y });
        corners.push({ x: wall.position.x + wall.width, y: wall.position.y });
        corners.push({ x: wall.position.x, y: wall.position.y + wall.height });
        corners.push({ x: wall.position.x + wall.width, y: wall.position.y + wall.height });
        // Add corners created by destroyed slices
        if (wall.destroyedSlices !== 0 && wall.destroyedSlices !== 0b11111) {
            const sliceDimension = (0, wallSliceHelpers_1.getSliceDimension)(wall);
            let addedCorners = 0;
            // Check each boundary between slices
            for (let i = 0; i <= 5; i++) {
                const adjacentSliceIndices = wall.orientation === 'horizontal'
                    ? { first: i - 1, second: i } // left/right for horizontal
                    : { first: i - 1, second: i }; // top/bottom for vertical
                // Get destruction state of adjacent slices
                const firstDestroyed = adjacentSliceIndices.first >= 0 && adjacentSliceIndices.first < 5
                    ? (wall.destroyedSlices >> adjacentSliceIndices.first) & 1
                    : 0;
                const secondDestroyed = adjacentSliceIndices.second >= 0 && adjacentSliceIndices.second < 5
                    ? (wall.destroyedSlices >> adjacentSliceIndices.second) & 1
                    : 0;
                // Add corners where destruction state changes
                if (firstDestroyed !== secondDestroyed) {
                    const boundaryPos = (0, wallSliceHelpers_1.getSliceBoundaryPosition)(wall, i);
                    if (wall.orientation === 'horizontal') {
                        // Add both top and bottom corners at this vertical boundary
                        corners.push({ x: boundaryPos, y: wall.position.y });
                        corners.push({ x: boundaryPos, y: wall.position.y + wall.height });
                    }
                    else {
                        // Add both left and right corners at this horizontal boundary
                        corners.push({ x: wall.position.x, y: boundaryPos });
                        corners.push({ x: wall.position.x + wall.width, y: boundaryPos });
                    }
                    addedCorners += 2;
                }
            }
            if (addedCorners > 0) {
                // console.log(`[VisibilityPolygon] Wall ${wall.id} (mask: ${wall.destroyedSlices.toString(2).padStart(5, '0')}) added ${addedCorners} destruction corners`);
            }
        }
        return corners;
    }
    /**
     * Check if a corner is exterior (affects visibility) by testing adjacent walls
     */
    isExteriorCorner(corner, viewerPos) {
        // Count walls touching this corner
        let wallCount = 0;
        const touchingWalls = [];
        this.walls.forEach((wall) => {
            if (wall.destroyedSlices === 0b11111)
                return;
            // Check if corner is on wall boundary
            const onLeft = Math.abs(corner.x - wall.position.x) < 0.1;
            const onRight = Math.abs(corner.x - (wall.position.x + wall.width)) < 0.1;
            const onTop = Math.abs(corner.y - wall.position.y) < 0.1;
            const onBottom = Math.abs(corner.y - (wall.position.y + wall.height)) < 0.1;
            if ((onLeft || onRight) && (onTop || onBottom)) {
                wallCount++;
                touchingWalls.push(wall);
            }
        });
        // Single wall corners are always exterior
        if (wallCount <= 1)
            return true;
        // For corners with 2+ walls, check if it forms a concave angle towards viewer
        if (wallCount === 2) {
            // Calculate if this is an interior corner by checking angles
            const angles = [];
            touchingWalls.forEach((wall) => {
                // Find which edge of the wall contains this corner
                const edges = this.getWallEdgesContainingPoint(wall, corner);
                edges.forEach(edge => {
                    const angle = Math.atan2(edge.dy, edge.dx);
                    angles.push(angle);
                });
            });
            // Sort angles and check if they form interior corner
            angles.sort((a, b) => a - b);
            for (let i = 0; i < angles.length; i++) {
                const nextI = (i + 1) % angles.length;
                let angleDiff = angles[nextI] - angles[i];
                if (angleDiff < 0)
                    angleDiff += 2 * Math.PI;
                // If angle difference > PI, this is exterior facing viewer
                if (angleDiff > Math.PI) {
                    const midAngle = angles[i] + angleDiff / 2;
                    const toViewer = Math.atan2(viewerPos.y - corner.y, viewerPos.x - corner.x);
                    let diff = Math.abs(midAngle - toViewer);
                    if (diff > Math.PI)
                        diff = 2 * Math.PI - diff;
                    if (diff < Math.PI / 2)
                        return true;
                }
            }
        }
        // Conservative: when in doubt, include the corner
        return wallCount < 4;
    }
    /**
     * Get wall edges that contain a specific point
     */
    getWallEdgesContainingPoint(wall, point) {
        const edges = [];
        const epsilon = 0.1;
        // Top edge
        if (Math.abs(point.y - wall.position.y) < epsilon &&
            point.x >= wall.position.x - epsilon &&
            point.x <= wall.position.x + wall.width + epsilon) {
            edges.push({ dx: 1, dy: 0 });
        }
        // Bottom edge
        if (Math.abs(point.y - (wall.position.y + wall.height)) < epsilon &&
            point.x >= wall.position.x - epsilon &&
            point.x <= wall.position.x + wall.width + epsilon) {
            edges.push({ dx: -1, dy: 0 });
        }
        // Left edge
        if (Math.abs(point.x - wall.position.x) < epsilon &&
            point.y >= wall.position.y - epsilon &&
            point.y <= wall.position.y + wall.height + epsilon) {
            edges.push({ dx: 0, dy: -1 });
        }
        // Right edge
        if (Math.abs(point.x - (wall.position.x + wall.width)) < epsilon &&
            point.y >= wall.position.y - epsilon &&
            point.y <= wall.position.y + wall.height + epsilon) {
            edges.push({ dx: 0, dy: 1 });
        }
        return edges;
    }
    /**
     * Cast a ray from viewer position at given angle
     */
    castRay(viewerPos, angle) {
        const dx = Math.cos(angle);
        const dy = Math.sin(angle);
        let closestIntersection = null;
        let closestDistance = this.viewDistance;
        // Check intersection with all walls
        this.walls.forEach((wall) => {
            // Skip fully destroyed walls
            if (wall.destroyedSlices === 0b11111)
                return;
            const intersection = this.rayRectIntersection(viewerPos, { x: dx, y: dy }, wall.position, wall.width, wall.height);
            if (intersection) {
                const dist = Math.hypot(intersection.x - viewerPos.x, intersection.y - viewerPos.y);
                if (dist < closestDistance) {
                    // Check which slice the ray hits
                    const hitSliceIndex = (0, wallSliceHelpers_1.calculateSliceIndex)(wall, intersection);
                    // Check if the hit slice is destroyed
                    const sliceDestroyed = (wall.destroyedSlices & (1 << hitSliceIndex)) !== 0;
                    if (!sliceDestroyed) {
                        // Hit an intact slice - this is our intersection
                        closestIntersection = intersection;
                        closestDistance = dist;
                    }
                    else {
                        // Hit a destroyed slice - check for slice boundaries
                        // Cast ray through the wall to find where it would exit or hit an intact slice
                        const sliceBoundaryHit = this.checkSliceBoundaries(wall, viewerPos, { x: dx, y: dy }, intersection);
                        if (sliceBoundaryHit && sliceBoundaryHit.distance < closestDistance) {
                            closestIntersection = sliceBoundaryHit.point;
                            closestDistance = sliceBoundaryHit.distance;
                        }
                    }
                }
            }
        });
        // If no intersection, ray extends to view distance
        if (!closestIntersection) {
            closestIntersection = {
                x: viewerPos.x + dx * this.viewDistance,
                y: viewerPos.y + dy * this.viewDistance
            };
        }
        return closestIntersection;
    }
    /**
     * Ray-rectangle intersection test
     */
    rayRectIntersection(origin, direction, rectPos, width, height) {
        const tMin = 0;
        const tMax = this.viewDistance;
        // Calculate t values for intersection with each edge
        const tx1 = (rectPos.x - origin.x) / direction.x;
        const tx2 = (rectPos.x + width - origin.x) / direction.x;
        const ty1 = (rectPos.y - origin.y) / direction.y;
        const ty2 = (rectPos.y + height - origin.y) / direction.y;
        const tMinX = Math.min(tx1, tx2);
        const tMaxX = Math.max(tx1, tx2);
        const tMinY = Math.min(ty1, ty2);
        const tMaxY = Math.max(ty1, ty2);
        const tEnter = Math.max(tMinX, tMinY, tMin);
        const tExit = Math.min(tMaxX, tMaxY, tMax);
        if (tEnter <= tExit && tEnter >= 0) {
            return {
                x: origin.x + direction.x * tEnter,
                y: origin.y + direction.y * tEnter
            };
        }
        return null;
    }
    /**
     * Check for slice boundaries when ray enters through a destroyed slice
     */
    checkSliceBoundaries(wall, rayStart, rayDir, entryPoint) {
        const sliceDimension = (0, wallSliceHelpers_1.getSliceDimension)(wall);
        let closestHit = null;
        // Calculate which slice we entered through
        const entrySliceIndex = (0, wallSliceHelpers_1.calculateSliceIndex)(wall, entryPoint);
        // Check all slice boundaries for potential hits
        for (let sliceIndex = 0; sliceIndex <= 5; sliceIndex++) {
            // Check if this boundary is between destroyed and intact slices
            const leftSlice = sliceIndex - 1;
            const rightSlice = sliceIndex;
            const leftDestroyed = leftSlice >= 0 && leftSlice < 5 ?
                (wall.destroyedSlices & (1 << leftSlice)) !== 0 : true;
            const rightDestroyed = rightSlice >= 0 && rightSlice < 5 ?
                (wall.destroyedSlices & (1 << rightSlice)) !== 0 : true;
            // Skip if both sides are the same (both destroyed or both intact)
            if (leftDestroyed === rightDestroyed)
                continue;
            // Calculate boundary position
            const boundaryPos = (0, wallSliceHelpers_1.getSliceBoundaryPosition)(wall, sliceIndex);
            // Check if ray intersects this boundary based on wall orientation
            if (wall.orientation === 'horizontal') {
                // Check vertical boundary (constant X)
                if (Math.abs(rayDir.x) > 0.0001) {
                    const t = (boundaryPos - entryPoint.x) / rayDir.x;
                    // Only consider forward intersections
                    if (t > 0) {
                        const intersectY = entryPoint.y + rayDir.y * t;
                        // Check if intersection is within wall bounds
                        if (intersectY >= wall.position.y && intersectY <= wall.position.y + wall.height) {
                            const hitPoint = { x: boundaryPos, y: intersectY };
                            const distance = Math.hypot(hitPoint.x - rayStart.x, hitPoint.y - rayStart.y);
                            // Update closest hit if this is nearer
                            if (!closestHit || distance < closestHit.distance) {
                                // Only count as hit if we're moving from destroyed to intact
                                const movingRight = rayDir.x > 0;
                                const hittingIntact = movingRight ? !rightDestroyed : !leftDestroyed;
                                if (hittingIntact) {
                                    closestHit = { point: hitPoint, distance: distance };
                                }
                            }
                        }
                    }
                }
            }
            else {
                // Vertical wall - check horizontal boundary (constant Y)
                if (Math.abs(rayDir.y) > 0.0001) {
                    const t = (boundaryPos - entryPoint.y) / rayDir.y;
                    // Only consider forward intersections
                    if (t > 0) {
                        const intersectX = entryPoint.x + rayDir.x * t;
                        // Check if intersection is within wall bounds
                        if (intersectX >= wall.position.x && intersectX <= wall.position.x + wall.width) {
                            const hitPoint = { x: intersectX, y: boundaryPos };
                            const distance = Math.hypot(hitPoint.x - rayStart.x, hitPoint.y - rayStart.y);
                            // Update closest hit if this is nearer
                            if (!closestHit || distance < closestHit.distance) {
                                // Only count as hit if we're moving from destroyed to intact
                                const movingDown = rayDir.y > 0;
                                const topSlice = sliceIndex - 1;
                                const bottomSlice = sliceIndex;
                                const hittingIntact = movingDown ? !rightDestroyed : !leftDestroyed;
                                if (hittingIntact) {
                                    closestHit = { point: hitPoint, distance: distance };
                                }
                            }
                        }
                    }
                }
            }
        }
        // Also check if ray exits the wall through an intact slice
        // Calculate exit point from wall
        const tExitX = rayDir.x > 0 ?
            (wall.position.x + wall.width - entryPoint.x) / rayDir.x :
            (wall.position.x - entryPoint.x) / rayDir.x;
        const tExitY = rayDir.y > 0 ?
            (wall.position.y + wall.height - entryPoint.y) / rayDir.y :
            (wall.position.y - entryPoint.y) / rayDir.y;
        const tExit = Math.min(Math.abs(tExitX), Math.abs(tExitY));
        if (tExit > 0) {
            const exitX = entryPoint.x + rayDir.x * tExit;
            const exitY = entryPoint.y + rayDir.y * tExit;
            // Clamp to wall bounds
            const clampedExitX = Math.max(wall.position.x, Math.min(wall.position.x + wall.width, exitX));
            const clampedExitY = Math.max(wall.position.y, Math.min(wall.position.y + wall.height, exitY));
            // Check which slice we're exiting through
            const exitSliceIndex = (0, wallSliceHelpers_1.calculateSliceIndex)(wall, { x: clampedExitX, y: clampedExitY });
            const exitSliceDestroyed = (wall.destroyedSlices & (1 << exitSliceIndex)) !== 0;
            if (!exitSliceDestroyed) {
                // Exiting through intact slice
                const hitPoint = { x: clampedExitX, y: clampedExitY };
                const distance = Math.hypot(hitPoint.x - rayStart.x, hitPoint.y - rayStart.y);
                if (!closestHit || distance < closestHit.distance) {
                    closestHit = { point: hitPoint, distance: distance };
                }
            }
        }
        return closestHit;
    }
    /**
     * Find intersection points between an edge and the vision arc
     * Returns 0, 1, or 2 points where the edge crosses the arc
     */
    findArcEdgeIntersections(edge, viewerPos, viewDirection) {
        const intersections = [];
        const leftBound = viewDirection - this.viewAngle / 2;
        const rightBound = viewDirection + this.viewAngle / 2;
        // Ray-circle intersection for the edge treated as an infinite line
        const dx = edge.end.x - edge.start.x;
        const dy = edge.end.y - edge.start.y;
        const fx = edge.start.x - viewerPos.x;
        const fy = edge.start.y - viewerPos.y;
        const a = dx * dx + dy * dy;
        const b = 2 * (fx * dx + fy * dy);
        const c = fx * fx + fy * fy - this.viewDistance * this.viewDistance;
        const discriminant = b * b - 4 * a * c;
        if (discriminant < 0)
            return intersections; // No intersection
        const sqrt_discriminant = Math.sqrt(discriminant);
        const t1 = (-b - sqrt_discriminant) / (2 * a);
        const t2 = (-b + sqrt_discriminant) / (2 * a);
        // Check each intersection point
        for (const t of [t1, t2]) {
            if (t >= 0 && t <= 1) { // Point is on the line segment
                const x = edge.start.x + t * dx;
                const y = edge.start.y + t * dy;
                // Check if point is within the FOV angle
                const angle = Math.atan2(y - viewerPos.y, x - viewerPos.x);
                if (this.isAngleInViewCone(angle, leftBound, rightBound)) {
                    intersections.push({ x, y });
                }
            }
        }
        return intersections;
    }
    /**
     * Convert visibility polygon to tile visibility for compatibility
     */
    calculateTileVisibility(viewerPos, viewDirection) {
        const polygon = this.calculateVisibility(viewerPos, viewDirection);
        const tilesX = Math.ceil(constants_1.GAME_CONFIG.GAME_WIDTH / 8);
        const tilesY = Math.ceil(constants_1.GAME_CONFIG.GAME_HEIGHT / 8);
        const visibility = Array(tilesY).fill(null).map(() => Array(tilesX).fill(false));
        // Rasterize polygon to tiles
        for (let y = 0; y < tilesY; y++) {
            for (let x = 0; x < tilesX; x++) {
                const tileCenter = {
                    x: x * 8 + 4,
                    y: y * 8 + 4
                };
                if (this.pointInPolygon(tileCenter, polygon)) {
                    visibility[y][x] = true;
                }
            }
        }
        return visibility;
    }
    /**
     * Point-in-polygon test using ray casting
     */
    pointInPolygon(point, polygon) {
        let inside = false;
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            const xi = polygon[i].x, yi = polygon[i].y;
            const xj = polygon[j].x, yj = polygon[j].y;
            const intersect = ((yi > point.y) !== (yj > point.y))
                && (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
            if (intersect)
                inside = !inside;
        }
        return inside;
    }
    /**
     * Remove player (compatibility method)
     */
    removePlayer(playerId) {
        // No player-specific state in polygon system
    }
    /**
     * Get raw visibility polygon (for pixel-perfect rendering)
     * Returns vertices of the visibility polygon in order
     */
    getVisibilityPolygon(viewerPos, viewDirection) {
        return this.calculateVisibility(viewerPos, viewDirection);
    }
    /**
     * Get visibility data in a compact format for network transmission
     */
    getVisibilityData(player) {
        const polygon = this.calculateVisibility(player.transform.position, player.transform.rotation);
        return {
            polygon,
            viewAngle: this.viewAngle,
            viewDirection: player.transform.rotation,
            viewDistance: this.viewDistance
        };
    }
    /**
     * Update player vision (main method called by GameStateSystem)
     * Returns a Set of visible tile indices for compatibility with TileVisionSystem
     */
    updatePlayerVisionRaycast(player) {
        const visibility = this.calculateTileVisibility(player.transform.position, player.transform.rotation);
        // Convert 2D boolean array to Set of tile indices
        const visibleTiles = new Set();
        const tilesX = Math.ceil(constants_1.GAME_CONFIG.GAME_WIDTH / 8);
        for (let y = 0; y < visibility.length; y++) {
            for (let x = 0; x < visibility[y].length; x++) {
                if (visibility[y][x]) {
                    const tileIndex = y * tilesX + x;
                    visibleTiles.add(tileIndex);
                }
            }
        }
        return visibleTiles;
    }
    /**
     * Get debug information about the current visibility calculation
     */
    getDebugInfo(viewerPos, viewDirection) {
        const leftBound = viewDirection - this.viewAngle / 2;
        const rightBound = viewDirection + this.viewAngle / 2;
        const corners = this.findVisibleCorners(viewerPos, viewDirection);
        return {
            corners: corners,
            bounds: {
                left: leftBound * 180 / Math.PI,
                right: rightBound * 180 / Math.PI
            }
        };
    }
}
exports.VisibilityPolygonSystem = VisibilityPolygonSystem;
