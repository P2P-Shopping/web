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
        /**
         * Event handler for when the browser goes online.
         * Updates the Zustand store's isOnline state to true.
         */
        const handleOnline = (): void => {
            setOnlineStatus(true);
        };

        /**
         * Event handler for when the browser goes offline.
         * Updates the Zustand store's isOnline state to false.
         */
        const handleOffline = (): void => {
            setOnlineStatus(false);
        };

        // Attach listeners for online and offline events
        globalThis.addEventListener("online", handleOnline);
        globalThis.addEventListener("offline", handleOffline);

        // Immediate fallback check in case state changed before listener attached
        setOnlineStatus(navigator.onLine);

        // Explicitly remove listeners on cleanup to prevent memory leaks
        return () => {
            globalThis.removeEventListener("online", handleOnline);
            globalThis.removeEventListener("offline", handleOffline);
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
