export interface P2PBridge {
    getDeviceId: () => string;
    platform: "android" | "web";
}

declare global {
    interface Window {
        P2PBridge?: P2PBridge;
    }
}
