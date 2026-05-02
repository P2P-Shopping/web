import { useEffect, useRef } from "react";
import { useStore } from "../context/useStore";
import { useDeviceId } from "./useDeviceId";

const TELEMETRY_API_KEY = import.meta.env.VITE_TELEMETRY_API_KEY;

/**
 * Custom React hook to monitor OS/browser network connectivity.
 * Attaches to the global window 'online' and 'offline' events.
 *
 * When network state changes, it updates the global Zustand store,
 * which triggers reactivity globally.
 */
export const useNetworkState = (): void => {
    const setOnlineStatus = useStore((state) => state.setOnlineStatus);
    const deviceId = useDeviceId();
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const retryCountRef = useRef(0);
    const telemetryAuthInvalidRef = useRef(false);

    const BASE_DELAY = 10_000;
    const MAX_DELAY = 60_000;

    useEffect(() => {
        const schedulePing = (delay: number) => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            timeoutRef.current = setTimeout(ping, delay);
        };

        const ping = async () => {
            if (telemetryAuthInvalidRef.current) return;

            if (!useStore.getState().hasEnteredStore) {
                // If not in the store, just wait for the next cycle
                schedulePing(BASE_DELAY);
                return;
            }

            if (!navigator.onLine) {
                // Pause the loop. It will be resumed by the 'online' event listener.
                return;
            }

            try {
                const res = await fetch("/api/v1/telemetry/ping", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "X-API-Key": TELEMETRY_API_KEY,
                        "X-Device-Id": deviceId,
                    },
                    body: JSON.stringify({ ts: Date.now() }),
                    signal: AbortSignal.timeout(5000),
                });

                if (res.ok || res.status === 202 || res.status === 401) {
                    if (res.status === 401) {
                        telemetryAuthInvalidRef.current = true;
                        console.error(
                            "Telemetry ping unauthorized. Check VITE_TELEMETRY_API_KEY and telemetry.api.key.",
                        );
                        return;
                    }

                    retryCountRef.current = 0;
                    schedulePing(BASE_DELAY);
                } else {
                    throw new Error("Ping failed");
                }
            } catch {
                retryCountRef.current++;
                const backoffDelay = Math.min(
                    BASE_DELAY * 2 ** retryCountRef.current,
                    MAX_DELAY,
                );
                schedulePing(backoffDelay);
            }
        };

        const handleOnline = (): void => {
            setOnlineStatus(true);
            // Resume the loop immediately when back online
            ping();
        };

        const handleOffline = (): void => {
            setOnlineStatus(false);
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };

        // Attach listeners for online and offline events
        globalThis.addEventListener("online", handleOnline);
        globalThis.addEventListener("offline", handleOffline);

        // Immediate fallback check in case state changed before listener attached
        setOnlineStatus(navigator.onLine);

        // Start the loop
        ping(); // immediately on mount

        // Explicitly remove listeners and clear timeout on cleanup
        return () => {
            globalThis.removeEventListener("online", handleOnline);
            globalThis.removeEventListener("offline", handleOffline);
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, [setOnlineStatus]);
};
