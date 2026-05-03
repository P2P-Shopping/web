// src/services/loadRoute.ts

import { useStore } from "../context/useStore";
import { calculateMockTspRoute, type MockRouteSeed } from "./mockTsp";
import { calculateRoute } from "./routingService";

// Module-level cleanup to prevent multiple polling loops from accumulating
let activePollCleanup: (() => void) | null = null;

/**
 * Coordinates for items inside Palas Mall (Iași) as seeded in the backend
 * init-scripts/99-populare.sql (raw_user_pings for store 8f3e1a2b-c4d5-6e7f-8a9b-0c1d2e3f4a5b).
 *
 * Each entry uses the most representative ping (WIFI_RTT / GPS) for that item
 * inside the Palas store footprint.
 */
const PALAS_ITEMS: Record<string, { name: string; lat: number; lng: number }> =
    {
        "11111111-a1b2-c3d4-e5f6-1234567890ab": {
            name: "Produs 1",
            lat: 47.155432,
            lng: 27.586797,
        },
        "22222222-b2c3-d4e5-f6a7-2345678901bc": {
            name: "Produs 2",
            lat: 47.155503,
            lng: 27.587166,
        },
        "33333333-c3d4-e5f6-a7b8-3456789012cd": {
            name: "Produs 3",
            lat: 47.155898,
            lng: 27.587173,
        },
        "44444444-d4e5-f6a7-b8c9-4567890123de": {
            name: "Produs 4",
            lat: 47.155387,
            lng: 27.587615,
        },
        "55555555-e5f6-a7b8-c9d0-5678901234ef": {
            name: "Produs 5",
            lat: 47.155998,
            lng: 27.586752,
        },
        "66666666-f6a7-b8c9-d0e1-6789012345f0": {
            name: "Produs 6",
            lat: 47.155574,
            lng: 27.587692,
        },
        "77777777-a7b8-c9d0-e1f2-789012345601": {
            name: "Produs 7",
            lat: 47.155734,
            lng: 27.58652,
        },
        "88888888-b8c9-d0e1-f2a3-890123456712": {
            name: "Produs 8",
            lat: 47.15671,
            lng: 27.587186,
        },
        "99999999-c9d0-e1f2-a3b4-901234567823": {
            name: "Produs 9",
            lat: 47.155495,
            lng: 27.587053,
        },
    };

/**
 * Loads the shopping route, either from the real backend API (priority)
 * or falling back to a local mock if the server is unavailable or has no data.
 */
export const loadRoute = async (
    productIds: string[],
    userLat: number,
    userLng: number,
) => {
    const { setRoute, setStatus } = useStore.getState();
    setStatus("Calculating route...");

    // Priority: Try to call the real SERVER API
    try {
        console.debug("[loadRoute] Requesting route from server API...");
        const serverData = await calculateRoute({
            userLat,
            userLng,
            productIds,
        });

        if (
            serverData?.status === "success" &&
            serverData.route.length > 0
        ) {
            console.log(
                "[loadRoute] Successfully received route from server API",
            );
            setRoute(serverData.route);
            setStatus("Optimized route loaded from server.");
            return;
        }
        console.warn("[loadRoute] Server returned empty route or non-success.");
    } catch (err) {
        console.error("[loadRoute] Server API call failed:", err);
    }

    // Fallback: Local mock logic
    console.debug("[loadRoute] Falling back to local mock TSP calculation...");
    const points: MockRouteSeed[] = [];
    const ids = productIds.length > 0 ? productIds : Object.keys(PALAS_ITEMS);

    for (const id of ids) {
        const item = PALAS_ITEMS[id];
        if (item) {
            points.push({
                itemId: id,
                name: item.name,
                lat: item.lat,
                lng: item.lng,
            });
        }
    }

    if (points.length === 0) {
        console.warn("[loadRoute] No items found for mock calculation.");
        setStatus("No items to route.");
        return;
    }

    const orderedRoute = calculateMockTspRoute(points, {
        lat: userLat,
        lng: userLng,
    });

    setRoute(orderedRoute);
    setStatus("Indoor mock TSP route ready (Fallback).");

    if (activePollCleanup) {
        activePollCleanup();
        activePollCleanup = null;
    }
};
