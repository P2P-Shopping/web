// src/services/loadRoute.ts

import { type RoutePoint, useStore } from "../context/useStore";
import routeData from "../data/route-mock.json";
import {
    type BackendRoutePoint,
    calculateRoute,
    pollFullRoute,
} from "./routingService";

// Module-level cleanup to prevent multiple polling loops from accumulating
let activePollCleanup: (() => void) | null = null;

// Converts backend format { itemId, lat, lng } to store format { itemId, name, lat, lng }
function toRoutePoint(p: BackendRoutePoint): RoutePoint {
    return { itemId: p.itemId, name: p.name, lat: p.lat, lng: p.lng };
}

/**
 * Calculates the optimal route for the given product IDs and user location.
 * - Sets the partial route immediately (first 5 stops)
 * - Polls in background and updates the route when 3-opt is done
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

    const data = await calculateRoute({
        userLat,
        userLng,
        productIds,
    });

    if (data.status === "error") {
        console.warn("Routing error:", data.warnings);
        setStatus(`Routing error: ${data.warnings.join(", ")}`);
        return;
    }

    // Set partial route immediately so the user sees something
    setRoute(data.route.map(toRoutePoint));

    // If partial, poll for the full optimized route
    if (data.partial && data.routeId) {
        // Cancel any existing poll before starting a new one
        if (activePollCleanup) activePollCleanup();

        activePollCleanup = pollFullRoute(
            data.routeId,
            (fullRoute) => {
                setRoute(fullRoute.map(toRoutePoint));
                activePollCleanup = null;
            },
            (error) => {
                console.error("Polling failed:", error);
                setStatus("Failed to load optimized route.");
                activePollCleanup = null;
            },
        );
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
