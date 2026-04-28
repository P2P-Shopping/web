// src/services/routingService.ts

export interface BackendRoutePoint {
    itemId: string;
    name: string;
    lat: number;
    lng: number;
}

export interface CalculateRouteRequest {
    userLat: number;
    userLng: number;
    productIds: string[];
    lazyN?: number;
}

export interface CalculateRouteResponse {
    status: string;
    partial: boolean;
    routeId: string | null;
    route: BackendRoutePoint[];
    warnings: string[];
}

export interface MacroEstimate {
    distanceM: number;
    durationSeconds: number;
}

export interface MacroRoutingResponse {
    walking: MacroEstimate | null;
    driving: MacroEstimate | null;
}

const BASE_URL = "/api/routing";
const TIMEOUT_MS = 10000;

/**
 * POST /api/routing/calculate
 * Calculates the optimal in-store route.
 * If lazyN > 0 and store has more products, returns partial response immediately
 * and starts background optimization.
 */
export async function calculateRoute(
    request: CalculateRouteRequest,
): Promise<CalculateRouteResponse> {
    const res = await fetch(`${BASE_URL}/calculate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Order is deliberate: request.lazyN will override the default 5
        body: JSON.stringify({ lazyN: 5, ...request }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!res.ok) throw new Error(`Calculate route failed: ${res.status}`);
    return res.json();
}

/**
 * GET /api/routing/full/{routeId}
 * Polls for the completed 3-opt optimized route.
 * Returns null if still computing (202), throws on error.
 */
export async function getFullRoute(
    routeId: string,
): Promise<CalculateRouteResponse | null> {
    const res = await fetch(`${BASE_URL}/full/${routeId}`, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (res.status === 202) return null; // still computing
    if (!res.ok) throw new Error(`Get full route failed: ${res.status}`);
    return res.json();
}

/**
 * GET /api/routing/macro
 * Returns walking and driving estimates from user location to store entrance.
 */
export async function getMacroEstimates(
    userLat: number,
    userLng: number,
    storeId: string,
): Promise<MacroRoutingResponse> {
    const params = new URLSearchParams({
        userLat: String(userLat),
        userLng: String(userLng),
        storeId,
    });

    const res = await fetch(`${BASE_URL}/macro?${params}`, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`Macro routing failed: ${res.status}`);
    return res.json();
}

/**
 * Polls GET /full/{routeId} until route is ready.
 * Uses a self-rescheduling setTimeout to avoid overlapping calls.
 * Returns a cleanup function to stop polling.
 */
export function pollFullRoute(
    routeId: string,
    onUpdate: (route: BackendRoutePoint[]) => void,
    onError?: (error: Error) => void,
    intervalMs = 2000,
    maxAttempts = 30,
): () => void {
    let timerId: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;

    async function poll() {
        attempts++;
        if (attempts > maxAttempts) {
            onError?.(new Error("Max polling attempts reached"));
            return;
        }

        try {
            const data = await getFullRoute(routeId);
            if (data) {
                onUpdate(data.route);
            } else {
                timerId = setTimeout(poll, intervalMs);
            }
        } catch (err) {
            onError?.(err instanceof Error ? err : new Error(String(err)));
        }
    }

    timerId = setTimeout(poll, intervalMs);

    return () => {
        if (timerId) clearTimeout(timerId);
    };
}
