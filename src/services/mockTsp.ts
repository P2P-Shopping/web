// src/services/mockTsp.ts

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

        // LOGICĂ NOUĂ: Manhattan Pathing (unghiuri de 90 grade)
        // Dacă distanța e mai mare de 2 metri, inserăm un punct intermediar pentru ocolirea raftului
        if (getDistanceMeters(cursor, nextPoint) > 2) {
            const latDiff = Math.abs(nextPoint.lat - cursor.lat);
            const lngDiff = Math.abs(nextPoint.lng - cursor.lng);

            if (latDiff > lngDiff) {
                // Ne mișcăm întâi pe axa X (Longitudine), apoi pe Y (Latitudine)
                orderedRoute.push({
                    itemId: `waypoint-${nextPoint.itemId}-1`,
                    name: "Culoar",
                    lat: cursor.lat,
                    lng: nextPoint.lng,
                    audio_instruction: "Încadrează-te pe culoarul principal.",
                } as unknown as RoutePoint);
            } else {
                // Ne mișcăm întâi pe axa Y (Latitudine), apoi pe X (Longitudine)
                orderedRoute.push({
                    itemId: `waypoint-${nextPoint.itemId}-2`,
                    name: "Culoar",
                    lat: nextPoint.lat,
                    lng: cursor.lng,
                    audio_instruction: "Fă o manevră printre rafturi.",
                } as unknown as RoutePoint);
            }
        }

        // Adăugăm destinația reală (produsul)
        orderedRoute.push({ ...nextPoint });
        cursor = { lat: nextPoint.lat, lng: nextPoint.lng };
    }

    return orderedRoute;
}
