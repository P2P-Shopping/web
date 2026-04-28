import type { Coordinate } from "../context/useStore";

export const GEOFENCE_RADIUS_METERS = 150;
export const DEMO_STORE_LOCATION: Coordinate = {
    lat: 47.1532,
    lng: 27.5891,
};

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
