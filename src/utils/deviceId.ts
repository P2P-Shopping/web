import { isWebView } from "./webview";

const TELEMETRY_DEVICE_ID_KEY = "p2ps.telemetry.device-id";

type GlobalWithBridge = typeof globalThis & {
    P2PBridge?: {
        getDeviceId: () => string;
        getPlatform: () => string;
    };
};

/**
 * Returns a stable device ID for telemetry.
 * Defensive: falls back gracefully if the bridge throws or storage is restricted.
 */
export const getDeviceId = (): string => {
    const g = globalThis as GlobalWithBridge;

    if (isWebView() && g.P2PBridge) {
        try {
            const bridgeId = g.P2PBridge.getDeviceId()?.trim();
            if (bridgeId) return bridgeId;
        } catch {
            // fall through to browser fallback
        }
    }

    let existingId: string | null = null;
    try {
        existingId =
            globalThis.localStorage?.getItem(TELEMETRY_DEVICE_ID_KEY) ?? null;
    } catch {
        // storage unavailable; continue to generated fallback
    }
    if (existingId) {
        return existingId;
    }

    const generatedId = `telemetry-device-${crypto.randomUUID()}`;
    try {
        globalThis.localStorage?.setItem(TELEMETRY_DEVICE_ID_KEY, generatedId);
    } catch {
        // ignore persistence failures; still return stable value for this call
    }
    return generatedId;
};
