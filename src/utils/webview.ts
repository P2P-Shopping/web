declare global {
    interface Window {
        P2PBridge?: {
            getDeviceId: () => string;
            getPlatform: () => string;
        };
    }
}

type GlobalWithBridge = typeof globalThis & {
    P2PBridge?: Window["P2PBridge"];
};

/**
 * Returns true if the app is running inside the P2P Android WebView.
 * Detection is based on the native JS bridge injected by the Android app.
 */
export const isWebView = (): boolean => {
    if (typeof globalThis === "undefined") return false;
    return (
        typeof (globalThis as GlobalWithBridge).P2PBridge?.getDeviceId ===
        "function"
    );
};

/**
 * Returns the platform string: "android" when in WebView, "web" otherwise.
 */
export const getPlatform = (): "android" | "web" => {
    if (isWebView() && (globalThis as GlobalWithBridge).P2PBridge) {
        return "android";
    }
    return "web";
};
