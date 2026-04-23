import type React from "react";
import { useStore } from "../../context/useStore";
import "./OfflineBanner.css";

interface OfflineBannerProps {
    hasNavbar?: boolean;
}

/**
 * Component that displays a global visual warning when the device loses its internet connection
 * or when the backend server is unreachable.
 */
export const OfflineBanner: React.FC<OfflineBannerProps> = ({
    hasNavbar = false,
}) => {
    const isOnline = useStore((state) => state.isOnline);
    const isServerConnected = useStore((state) => state.isServerConnected);

    if (!isOnline) {
        return (
            <div className={`offline-banner ${hasNavbar ? "with-navbar" : ""}`}>
                <span className="offline-icon">⚠️</span>
                <span className="offline-text">
                    Working Offline (No Internet)
                </span>
            </div>
        );
    }

    if (!isServerConnected) {
        return (
            <div
                className={`offline-banner server-disconnected ${hasNavbar ? "with-navbar" : ""}`}
            >
                {/*<span className="offline-icon">🔌</span>*/}
                <span className="offline-text">Server Connection Lost</span>
            </div>
        );
    }

    return null;
};
