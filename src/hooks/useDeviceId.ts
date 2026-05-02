import { useIsWebView } from "./useIsWebView";
import type { P2PBridge } from "../types/bridge";

const TELEMETRY_DEVICE_ID_KEY = "p2ps.telemetry.device-id";

/**
 * Hook to get the device ID.
 * Returns the bridge device ID if running in WebView,
 * otherwise generates and caches a local ID.
 */
export const useDeviceId = (): string => {
    const isWebView = useIsWebView();

    if (isWebView) {
        try {
            const bridge = (globalThis as any).P2PBridge as P2PBridge;
            if (bridge && typeof bridge.getDeviceId === "function") {
                const bridgeDeviceId = bridge.getDeviceId();
                if (bridgeDeviceId) {
                    return bridgeDeviceId;
                }
            }
        } catch (error) {
            console.warn("Failed to get device ID from bridge:", error);
        }
    }

    // Fallback to locally generated device ID
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
