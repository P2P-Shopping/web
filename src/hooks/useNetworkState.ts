import { useEffect, useRef } from "react";
import { useStore } from "../context/useStore";
import { useDeviceId } from '../hooks/useDeviceId';
/**
 * Custom React hook to monitor OS/browser network connectivity.
 * Attaches to the global window 'online' and 'offline' events.
 *
 * When network state changes, it updates the global Zustand store,
 * which triggers reactivity globally.
 */
export const useNetworkState = (): void => {
    const deviceId = useDeviceId();
    const setOnlineStatus = useStore((state) => state.setOnlineStatus);
    const setServerConnected = useStore((state) => state.setServerConnected);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
                const deviceId = getTelemetryDeviceId();
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
    useEffect(() => {
        const ping = async (): Promise<void> => {
            if (!navigator.onLine) {
                setServerConnected(false);
                return;
            }
            try {
                const payload = { ts: Date.now(), deviceId };
                console.log('📡 Telemetry ping payload:', payload);
                const res = await fetch("/api/v1/telemetry/ping", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                    signal: AbortSignal.timeout(5000),
                });
                setServerConnected(res.ok || res.status === 202);
            } catch {
                setServerConnected(false);
            }
        };
        ping(); // imediat la mount
        intervalRef.current = setInterval(ping, 10_000);

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [setServerConnected]);
};
