import { create } from "zustand";

type Coordinate = { lat: number; lng: number };

export interface RoutePoint {
  itemId: string;
  name: string;
  lat: number;
  lng: number;
}

interface AppState {
  userLocation: Coordinate;
  route: RoutePoint[];
  status: string;
  setUserLocation: (loc: Coordinate) => void;
  setRoute: (route: RoutePoint[]) => void;
  setStatus: (status: string) => void;
}

export const useStore = create<AppState>((set) => ({
  userLocation: { lat: 47.151726, lng: 27.587914 },
  route: [],
  status: "idle",
  setUserLocation: (loc) => set({ userLocation: loc }),
  setRoute: (route) => set({ route }),
  setStatus: (status) => set({ status }),
}));
