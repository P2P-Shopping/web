import React from "react";
import { useStore } from "../../context/useStore";
import "./OfflineBanner.css";

/**
 * Component that displays a global visual warning when the device loses its internet connection.
 * It reads the isOnline state governed by the 'useNetworkState' hook, preventing STOMP errors.
 * Renders absolutely nothing if the connection is perfectly fine.
 */
export const OfflineBanner: React.FC = () => {
    // Read the online presence directly from the global Zustand store
    const isOnline = useStore((state) => state.isOnline);

    if (isOnline) {
        return null;
    }

    return (
        <div className="offline-banner">
            <span className="offline-icon">⚠️</span>
            <span className="offline-text">Working Offline</span>
        </div>
    );
};
