// src/services/loadRoute.ts

import { useStore } from "../context/useStore";
import { calculateMockTspRoute, type MockRouteSeed } from "./mockTsp";
import { calculateRoute, pollFullRoute } from "./routingService";

let activePollCleanup: (() => void) | null = null;

const PALAS_ITEMS: Record<string, { name: string; lat: number; lng: number }> = {
    "aaaa1111-1111-1111-1111-111111111111": { name: "Lapte Test", lat: 47.15700, lng: 27.58606 },
    "aaaa2222-2222-2222-2222-222222222222": { name: "Pâine Test", lat: 47.15685, lng: 27.58752 },
    "aaaa3333-3333-3333-3333-333333333333": { name: "Mere Test", lat: 47.15600, lng: 27.58771 },
};

export const loadRoute = async (
    productIds: string[],
    userLat: number,
    userLng: number,
    fallbackItems: { id: string; name: string }[] = [],
) => {
    const { setRoute, setStatus } = useStore.getState();
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
            console.log("[loadRoute] Successfully received route from server API");
            setRoute(serverData.route);
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
                        console.warn("[loadRoute] Full route polling failed:", error);
                        setStatus("Partial route loaded from server.");
                        activePollCleanup = null;
                    },
                );
            }
            return;
        }
        console.warn("[loadRoute] Server returned empty route or non-success.");
    } catch (err) {
        console.error("[loadRoute] Server API call failed:", err);
    }

    console.debug("[loadRoute] Falling back to local mock TSP calculation...");
    const points: MockRouteSeed[] = [];
    const ids = productIds.length > 0 ? productIds : Object.keys(PALAS_ITEMS);

    // Baza de la care începem să distribuim produsele de test
    // Am modificat coordonatele pentru a fi mai "sus" și mai "la dreapta", exact în centrul magazinului
    const baseLat = 47.151820; 
    const baseLng = 27.587850;
    let testItemIndex = 0;

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
                // Am micșorat drastic spațierea: 0.00002 înseamnă aprox. 2 metri în realitate
                const aisleSpaceLat = 0.00002;
                const aisleSpaceLng = 0.00003;

                // Le așezăm pe 2 coloane (ca și cum ar fi pe ambele părți ale unui culoar)
                const latOffset = Math.floor(testItemIndex / 2) * aisleSpaceLat;
                const lngOffset = (testItemIndex % 2) * aisleSpaceLng;

                points.push({
                    itemId: fallbackItem.id,
                    name: fallbackItem.name,
                    lat: baseLat - latOffset, // Mergem în jos (minus) de la bază pe culoar
                    lng: baseLng + lngOffset,
                });
                testItemIndex++;
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
        "În 5 metri, ia-o la dreapta spre raionul de lactate.",
        "Mergi înainte 10 metri pe acest culoar.",
        "Ia-o la stânga și oprește-te în fața raftului.",
        "Întoarce-te, produsul este exact în spatele tău.",
        "Ai ajuns la destinația finală din lista ta.",
    ];

    orderedRoute.forEach((point, index) => {
        if (!point.audio_instruction) {
             point.audio_instruction = mockInstructions[index] || mockInstructions.at(-1);
        }
    });

    setRoute(orderedRoute);
    setStatus("Indoor mock TSP route ready (Fallback).");
    if (activePollCleanup) {
        activePollCleanup();
        activePollCleanup = null;
    }
};