import { WifiOff, Unplug } from "lucide-react";
import type React from "react";
import { useStore } from "../../context/useStore";

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
            <div
                className="fixed left-0 right-0 top-0 z-100 flex items-center justify-center gap-2 py-2 px-4 bg-danger text-white text-sm font-bold shadow-lg animate-in slide-in-from-top duration-300"
            >
                <WifiOff size={16} />
                <span>Working Offline (No Internet)</span>
            </div>
        );
    }

    if (!isServerConnected) {
        return (
            <div
                className="fixed left-0 right-0 top-0 z-100 flex items-center justify-center gap-2 py-2 px-4 bg-warning text-white text-sm font-bold shadow-lg animate-in slide-in-from-top duration-300"
            >
                <Unplug size={16} />
                <span>Server Connection Lost</span>
            </div>
        );
    }

    return null;
};
