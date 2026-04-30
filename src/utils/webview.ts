declare global {
    interface Window {
        P2PBridge?: {
            getDeviceId: () => string;
            getPlatform: () => string;
        };
    }
}

/**
 * Returns true if the app is running inside the P2P Android WebView.
 * Detection is based on the native JS bridge injected by the Android app.
 */
export const isWebView = (): boolean => {
    if (typeof window === "undefined") return false;
    return (
        "P2PBridge" in window &&
        typeof window.P2PBridge?.getDeviceId === "function"
    );
};

/**
 * Returns the platform string: "android" when in WebView, "web" otherwise.
 */
export const getPlatform = (): "android" | "web" => {
    if (isWebView() && window.P2PBridge) {
        return "android" as const;
    }
    return "web";
};
