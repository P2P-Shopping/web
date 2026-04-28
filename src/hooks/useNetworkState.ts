import { useEffect, useRef } from "react";
import { useStore } from "../context/useStore";

/**
 * Custom React hook to monitor OS/browser network connectivity.
 * Attaches to the global window 'online' and 'offline' events.
 *
 * When network state changes, it updates the global Zustand store,
 * which triggers reactivity globally.
 */
export const useNetworkState = (): void => {
    const setOnlineStatus = useStore((state) => state.setOnlineStatus);
    const setServerConnected = useStore((state) => state.setServerConnected);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const retryCountRef = useRef(0);

    const BASE_DELAY = 10_000;
    const MAX_DELAY = 60_000;

    useEffect(() => {
        const schedulePing = (delay: number) => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            timeoutRef.current = setTimeout(ping, delay);
        };

        const ping = async () => {
            if (!navigator.onLine) {
                setServerConnected(false);
                // Pause the loop. It will be resumed by the 'online' event listener.
                return;
            }

            try {
                const res = await fetch("/api/v1/telemetry/ping", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ ts: Date.now() }),
                    signal: AbortSignal.timeout(5000),
                });

                if (res.ok || res.status === 202) {
                    setServerConnected(true);
                    retryCountRef.current = 0;
                    schedulePing(BASE_DELAY);
                } else {
                    throw new Error("Ping failed");
                }
            } catch {
                setServerConnected(false);
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
            setServerConnected(false);
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
    }, [setOnlineStatus, setServerConnected]);
};
