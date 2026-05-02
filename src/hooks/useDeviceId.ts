import { useIsWebView } from "./useIsWebView";

export const useDeviceId = (): string => {
    const isWebView = useIsWebView();

    if (isWebView && window.P2PBridge) {
        return window.P2PBridge.getDeviceId();
    }

    // Fallback pentru browser: verificăm localStorage
    const storedId = localStorage.getItem("local_device_id");

    // Dacă am găsit ID-ul, îl returnăm. Aici TS știe sigur că este 'string', nu 'null'
    if (storedId) {
        return storedId;
    }

    // Dacă ajungem aici, înseamnă că nu avem ID, deci generăm unul nativ
    const newId = crypto.randomUUID();
    localStorage.setItem("local_device_id", newId);

    return newId;
};
