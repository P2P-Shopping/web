// src/services/loadRoute.ts

import { type RoutePoint, useStore } from "../context/useStore";
import routeData from "../data/route-mock.json";
import { calculateMockTspRoute } from "./mockTsp";

// Module-level cleanup to prevent multiple polling loops from accumulating
let activePollCleanup: (() => void) | null = null;

/**
 * Calculates the mock route for the given product IDs and user location.
 * The route is fully frontend-driven so geofence and indoor navigation work
 * without waiting on backend availability.
 *
 * @param productIds  UUIDs of items from the shopping list
 * @param userLat     current user latitude (must be inside a store geofence)
 * @param userLng     current user longitude
 */
export async function loadRoute(
    productIds: string[],
    userLat: number,
    userLng: number,
): Promise<void> {
    const { setRoute, setStatus } = useStore.getState();
    const ids =
        productIds.length > 0 ? productIds : routeData.map((p) => p.itemId);

    const mockSeeds = ids.map((productId, index) => {
        const base = routeData[index % routeData.length];
        const layer = Math.floor(index / routeData.length);

        return {
            itemId: productId,
            name: layer > 0 ? `${base.name} ${layer + 1}` : base.name,
            lat: base.lat + layer * 0.00003,
            lng: base.lng + layer * 0.00003,
        };
    });

    if (mockSeeds.length === 0) {
        setStatus("No indoor route points available.");
        setRoute([]);
        return;
    }

    const orderedRoute = calculateMockTspRoute(mockSeeds, {
        lat: userLat,
        lng: userLng,
    });

    setRoute(orderedRoute);
    setStatus("Indoor mock TSP route ready.");

    if (activePollCleanup) {
        activePollCleanup();
        activePollCleanup = null;
    }
}

// -----------------------------------------------------------------------
// Keep the mock loader so existing code that imports it doesn't break
// -----------------------------------------------------------------------
export function loadMockRoute() {
    const { setRoute } = useStore.getState();
    console.log("Mock route loaded:", routeData);
    setRoute(routeData as RoutePoint[]);
}
