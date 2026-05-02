/**
 * Hook to detect if the app is running inside an Android WebView.
 * Checks for the presence of window.P2PBridge or specific User-Agent markers.
 */
export const useIsWebView = (): boolean => {
    if (typeof globalThis === "undefined") {
        return false;
    }

    // Check if P2PBridge is exposed by the native Android app
    const hasP2PBridge = (globalThis as any).P2PBridge !== undefined;

    if (hasP2PBridge) {
        return true;
    }

    // Fallback: check User-Agent for WebView markers
    const userAgent = globalThis.navigator?.userAgent || "";
    const isAndroidWebView =
        /wv/.test(userAgent) || // Chrome on Android WebView
        /Linux; Android/.test(userAgent); // General Android WebView

    return isAndroidWebView;
};
