import type { Coordinate, RoutePoint } from "../context/useStore";

export interface MockRouteSeed {
    itemId: string;
    name: string;
    lat: number;
    lng: number;
}

const METERS_PER_DEGREE_LAT = 111320;

function getDistanceMeters(a: Coordinate, b: Coordinate): number {
    const metersPerDegreeLng =
        METERS_PER_DEGREE_LAT * Math.cos((a.lat * Math.PI) / 180);
    const dx = (b.lng - a.lng) * metersPerDegreeLng;
    const dy = (b.lat - a.lat) * METERS_PER_DEGREE_LAT;
    return Math.hypot(dx, dy);
}

export function calculateMockTspRoute(
    points: MockRouteSeed[],
    origin: Coordinate,
): RoutePoint[] {
    const remaining = [...points];
    const orderedRoute: RoutePoint[] = [];
    let cursor = { ...origin };

    while (remaining.length > 0) {
        let nearestIndex = 0;
        let nearestDistance = Number.POSITIVE_INFINITY;

        for (let index = 0; index < remaining.length; index++) {
            const candidate = remaining[index];
            const distance = getDistanceMeters(cursor, candidate);

            if (distance < nearestDistance) {
                nearestDistance = distance;
                nearestIndex = index;
            }
        }

        const nextPoint = remaining.splice(nearestIndex, 1)[0];
        orderedRoute.push({ ...nextPoint });
        cursor = { lat: nextPoint.lat, lng: nextPoint.lng };
    }

    return orderedRoute;
}
