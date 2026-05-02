import { WifiOff } from "lucide-react";
import type React from "react";
import { useStore } from "../../context/useStore";

/**
 * Component that displays a pill-shaped warning at the bottom of the screen
 * when the device loses its internet connection or when the backend server is unreachable.
 */
export const OfflineBanner: React.FC = () => {
    const isOnline = useStore((state) => state.isOnline);
    const isServerConnected = useStore((state) => state.isServerConnected);
    // If we have a top navbar/header, we might want to offset this,
    // but usually global banners stay at the very top (top-0).
    // For now, we'll just fix the prop error.

    const showBanner = !isOnline || !isServerConnected;

    if (!showBanner) return null;

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

    return (
        <div
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-100 flex items-center justify-center gap-2.5 py-2.5 px-6 bg-surface/90 backdrop-blur-md text-text-strong text-sm font-bold shadow-2xl rounded-full border border-border animate-in slide-in-from-bottom-4 duration-500"
            role="status"
            aria-live="polite"
        >
            <WifiOff
                size={18}
                className="text-warning animate-pulse"
                aria-hidden="true"
            />
            <span>Reconnecting...</span>
        </div>
    );
};
