import { useEffect } from "react";
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
        window.addEventListener("online", handleOnline);
        window.addEventListener("offline", handleOffline);

        // Immediate fallback check in case state changed before listener attached
        setOnlineStatus(navigator.onLine);

        // Explicitly remove listeners on cleanup to prevent memory leaks
        return () => {
            window.removeEventListener("online", handleOnline);
            window.removeEventListener("offline", handleOffline);
        };
    }, [setOnlineStatus]);
};
