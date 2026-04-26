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

export const useNetworkStore = create<NetworkStore>((set) => ({
  isOnline: navigator.onLine,
  isServerConnected: true,
  status: "online",

  setIsOnline: (isOnline) =>
    set((s) => ({
      isOnline,
      status: !isOnline ? "offline" : !s.isServerConnected ? "reconnecting" : "online",
    })),

  setIsServerConnected: (isServerConnected) =>
    set((s) => ({
      isServerConnected,
      status: !s.isOnline ? "offline" : !isServerConnected ? "reconnecting" : "online",
    })),
}));