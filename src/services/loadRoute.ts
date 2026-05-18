// src/services/loadRoute.ts

import { useStore } from "../context/useStore";
import { calculateMockTspRoute, type MockRouteSeed } from "./mockTsp";
import { calculateRoute, pollFullRoute } from "./routingService";

// Module-level cleanup to prevent multiple polling loops from accumulating
let activePollCleanup: (() => void) | null = null;

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

export const loadRoute = async (
    productIds: string[],
    userLat: number,
    userLng: number,
    fallbackItems: { id: string; name: string }[] = [],
) => {
    const { setRoute, setStatus, setRouteWarnings } = useStore.getState();
    setStatus("Calculating route...");

    try {
        console.debug("[loadRoute] Requesting route from server API...");
        const serverData = await calculateRoute({
            userLat,
            userLng,
            productIds,
        });

        if (
            serverData?.status === "success" &&
            (serverData?.route?.length ?? 0) > 0
        ) {
            console.log(
                "[loadRoute] Successfully received route from server API",
            );
            setRoute(serverData.route);
            setRouteWarnings(serverData.warnings ?? []);
            setStatus(
                serverData.partial
                    ? "Partial route loaded. Optimizing..."
                    : "Optimized route loaded from server.",
            );

            if (activePollCleanup) {
                activePollCleanup();
                activePollCleanup = null;
            }

            if (serverData.partial && serverData.routeId) {
                activePollCleanup = pollFullRoute(
                    serverData.routeId,
                    (fullRoute) => {
                        setRoute(fullRoute);
                        setStatus("Optimized route loaded from server.");
                        activePollCleanup = null;
                    },
                    (error) => {
                        console.warn(
                            "[loadRoute] Full route polling failed:",
                            error,
                        );
                        setStatus("Partial route loaded from server.");
                        activePollCleanup = null;
                    },
                );
            }
            return;
        }

        if ((serverData?.warnings?.length ?? 0) > 0) {
            setRouteWarnings(serverData.warnings);
            setRoute([]);
            setStatus("Unele produse nu au fost gasite.");
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
        } else {
            const fallbackItem = fallbackItems.find((entry) => entry.id === id);
            if (fallbackItem) {
                const index = points.length;
                const ring = Math.floor(index / 6) + 1;
                const angle = (index % 6) * (Math.PI / 3);
                const latOffset = Math.cos(angle) * 0.00008 * ring;
                const lngOffset = Math.sin(angle) * 0.0001 * ring;
                points.push({
                    itemId: fallbackItem.id,
                    name: fallbackItem.name,
                    lat: userLat + latOffset,
                    lng: userLng + lngOffset,
                });
            }
        }
    }

    if (points.length === 0) {
        console.warn("[loadRoute] No items found for mock calculation.");
        setRoute([]);
        setStatus("No items to route.");
        return;
    }

    const orderedRoute = calculateMockTspRoute(points, {
        lat: userLat,
        lng: userLng,
    });

    const mockInstructions = [
        "\u00cen 5 metri, ia-o la dreapta spre raionul de lactate.",
        "Mergi \u00eenainte 10 metri pe acest culoar.",
        "Ia-o la st\u00e2nga \u0219i opre\u0219te-te \u00een fa\u021ba raftului.",
        "\u00centoarce-te, produsul este exact \u00een spatele t\u0103u.",
        "Ai ajuns la destina\u021bia final\u0103 din lista ta.",
    ];

    orderedRoute.forEach((point, index) => {
        point.audio_instruction =
            mockInstructions[index] || mockInstructions.at(-1);
    });

    setRoute(orderedRoute);
    setRouteWarnings([]);
    setStatus("Indoor mock TSP route ready (Fallback).");
    if (activePollCleanup) {
        activePollCleanup();
        activePollCleanup = null;
    }
};
