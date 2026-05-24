import type { Coordinate } from "../context/useStore";

export const GEOFENCE_RADIUS_METERS = 150;

export function getDistanceMeters(a: Coordinate, b: Coordinate): number {
    const metersPerDegreeLat = 111320;
    const metersPerDegreeLng =
        metersPerDegreeLat * Math.cos((a.lat * Math.PI) / 180);
    const dx = (b.lng - a.lng) * metersPerDegreeLng;
    const dy = (b.lat - a.lat) * metersPerDegreeLat;
    return Math.hypot(dx, dy);
}

export function isWithinGeofence(
    userLocation: Coordinate,
    storeLocation: Coordinate,
    radiusMeters = GEOFENCE_RADIUS_METERS,
): boolean {
    return getDistanceMeters(userLocation, storeLocation) <= radiusMeters;
}

export function isPointInPolygon(
    point: Coordinate,
    polygon: Coordinate[],
): boolean {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i].lng;
        const yi = polygon[i].lat;
        const xj = polygon[j].lng;
        const yj = polygon[j].lat;

        const intersect =
            yi > point.lat !== yj > point.lat &&
            point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi) + xi;
        if (intersect) inside = !inside;
    }
    return inside;
}

export function isWithinStoreGeofence(
    userLocation: Coordinate,
    storeLocation: Coordinate,
    footprint?: Coordinate[] | null,
): boolean {
    if (footprint && footprint.length >= 3) {
        return isPointInPolygon(userLocation, footprint);
    }
    return isWithinGeofence(userLocation, storeLocation);
}
