import { isWebView } from "./webview";

const TELEMETRY_DEVICE_ID_KEY = "p2ps.telemetry.device-id";

/**
 * Returns a stable device ID for telemetry.
 * - In WebView: uses the native Android device ID via P2PBridge (consistent across reinstalls)
 * - In browser: generates and reuses a UUID stored in localStorage
 */
export const getDeviceId = (): string => {
    if (isWebView() && window.P2PBridge) {
        return window.P2PBridge.getDeviceId();
    }

    const existingId = globalThis.localStorage?.getItem(
        TELEMETRY_DEVICE_ID_KEY,
    );
    if (existingId) {
        return existingId;
    }

    const generatedId = `telemetry-device-${crypto.randomUUID()}`;
    globalThis.localStorage?.setItem(TELEMETRY_DEVICE_ID_KEY, generatedId);
    return generatedId;
};
