import { Unplug, WifiOff } from "lucide-react";
import type React from "react";
import { useStore } from "../../context/useStore";

/**
 * Component that displays a global visual warning when the device loses its internet connection
 * or when the backend server is unreachable.
 */
export const OfflineBanner: React.FC = () => {
    const isOnline = useStore((state) => state.isOnline);
    const isServerConnected = useStore((state) => state.isServerConnected);

    // If we have a top navbar/header, we might want to offset this, 
    // but usually global banners stay at the very top (top-0).
    // For now, we'll just fix the prop error.

    if (!isOnline) {
        return (
            <div
                className="fixed left-0 right-0 top-0 z-100 flex items-center justify-center gap-2 py-2 px-4 bg-danger text-white text-sm font-bold shadow-lg animate-in slide-in-from-top duration-300"
                role="status"
                aria-live="polite"
            >
                <WifiOff size={16} aria-hidden="true" />
                <span>Working Offline (No Internet)</span>
            </div>
        );
    }

    if (!isServerConnected) {
        return (
            <div
                className="fixed left-0 right-0 top-0 z-100 flex items-center justify-center gap-2 py-2 px-4 bg-warning text-white text-sm font-bold shadow-lg animate-in slide-in-from-top duration-300"
                role="status"
                aria-live="assertive"
            >
                <Unplug size={16} aria-hidden="true" />
                <span>Server Connection Lost</span>
            </div>
        );
    }

    return null;
};
