// src/store/useNetworkStore.ts
import { create } from "zustand";
export type NetworkStatus = "online" | "reconnecting" | "offline";

interface NetworkStore {
    isOnline: boolean;
    isServerConnected: boolean;
    status: NetworkStatus;
    setIsOnline: (v: boolean) => void;
    setIsServerConnected: (v: boolean) => void;
}
const computeStatus = (
    isOnline: boolean,
    isServerConnected: boolean,
): NetworkStatus => {
    if (!isOnline) return "offline";
    if (!isServerConnected) return "reconnecting";
    return "online";
};
export const useNetworkStore = create<NetworkStore>((set) => ({
    isOnline: navigator.onLine,
    isServerConnected: true,
    status: "online",

    setIsOnline: (isOnline) =>
        set((s) => ({
            isOnline,
            status: computeStatus(isOnline, s.isServerConnected),
        })),

    setIsServerConnected: (isServerConnected) =>
        set((s) => ({
            isServerConnected,
            status: computeStatus(s.isOnline, isServerConnected),
        })),
}));
