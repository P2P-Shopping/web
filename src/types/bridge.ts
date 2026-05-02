/**
 * Interface for the P2PBridge exposed by the native Android app.
 * This bridge allows the React app to communicate with native Android code.
 */
export interface P2PBridge {
    /**
     * Get the unique device ID from the native bridge.
     */
    getDeviceId(): string;

    /**
     * Get the platform identifier (e.g., "android").
     */
    getPlatform?(): string;
}

/**
 * Type declaration for the P2PBridge on the global window object.
 */
declare global {
    interface Window {
        P2PBridge?: P2PBridge;
    }
}

/**
 * Hook to get the platform from the bridge.
 * Returns the bridge platform if running in WebView, otherwise returns "web".
 */
export const usePlatform = (): string => {
    try {
        const bridge = (globalThis as unknown as Window).P2PBridge;
        if (bridge && typeof bridge.getPlatform === "function") {
            const platform = bridge.getPlatform();
            if (platform) {
                return platform;
            }
        }
    } catch (error) {
        console.warn("Failed to get platform from bridge:", error);
    }

    return "web";
};
