import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { QueuedAction } from "../types";

// 👇 Exported so MapPage and StoreMap can use it
export interface Coordinate {
    lat: number;
    lng: number;
}

export interface RoutePoint {
    itemId: string;
    name: string;
    lat: number;
    lng: number;
}

/**
 * Basic Item interface for Zustand
 */
export interface Item {
    id: string;
    name: string;
    checked: boolean;
}

interface AppState {
    userLocation: Coordinate;
    // 👇 ADDED: To pass the store location to the canvas
    targetStoreLocation: Coordinate | null;
    /** Current navigation stage for macro to micro transition */
    navigationMode: "city" | "indoor";
    /** Whether the app already crossed the geofence into the store */
    hasEnteredStore: boolean;
    /** Prevents duplicate geofence transitions while indoor route loads */
    isTransitioningToStore: boolean;
    /** Whether the map should automatically center on the user's location */
    isAutoCenterEnabled: boolean;
    /** Whether to use mock GPS updates or real navigator.geolocation */
    isMockGpsEnabled: boolean;

    route: RoutePoint[];
    status: string;
    /** Current list of items */
    items: Item[];
    /** Original item states before optimistic update */
    backupItems: Record<string, Item>;
    /** Tracks which items are in a conflict state */
    conflictItems: Record<string, boolean>;
    /** Tracks whether the application is currently online (has network connectivity) */
    isOnline: boolean;
    /** Tracks whether the application is connected to the backend server */
    isServerConnected: boolean;
    /** Current authenticated user info */
    user: { email: string; firstName?: string; userId?: string } | null;
    /** Whether the user is authenticated */
    isAuthenticated: boolean;
    /** Whether the initial auth check has been completed */
    authChecked: boolean;
    /** JWT Token */
    token: string | null;
    /** Queue of actions to be synced when back online */
    offlineQueue: QueuedAction[];
    /** Updates user location */
    setUserLocation: (loc: Coordinate) => void;

    // 👇 ADDED: Setter for target store
    setTargetStoreLocation: (loc: Coordinate | null) => void;
    /** Switches between city map and indoor canvas */
    setNavigationMode: (mode: "city" | "indoor") => void;
    /** Marks the geofence transition as completed */
    setHasEnteredStore: (value: boolean) => void;
    /** Locks or unlocks the geofence transition */
    setIsTransitioningToStore: (value: boolean) => void;
    /** Toggles map auto-centering */
    setIsAutoCenterEnabled: (value: boolean) => void;
    /** Toggles between mock and real GPS */
    setIsMockGpsEnabled: (value: boolean) => void;
    /** Manually triggers indoor mode and cross-geofence logic */
    forceIndoorMode: () => void;

    /** Sets the map route */
    setRoute: (route: RoutePoint[]) => void;
    /** Sets application status */
    setStatus: (status: string) => void;
    /** Sets the online status of the application */
    setOnlineStatus: (status: boolean) => void;
    /** Sets the server connection status */
    setServerConnected: (status: boolean) => void;
    /** Sets the full list of items */
    setItems: (items: Item[]) => void;
    /** Creates a backup of the item before an optimistic update */
    backupItemState: (item: Item) => void;
    /** Toggles the checked state optimistically */
    toggleItemOptimistic: (itemId: string, newChecked: boolean) => void;
    /** Reverts an optimistic UI update by restoring the backup state */
    rollbackItemState: (itemId: string) => void;
    /** Flags an item as experiencing a sync conflict */
    setItemConflict: (itemId: string, hasConflict: boolean) => void;
    /** Updates authentication state */
    setAuth: (user: unknown, token?: string | null) => void;
    /** Adds an action to the offline sync queue */
    enqueueAction: (action: QueuedAction) => void;
    /** Removes an action from the offline sync queue */
    dequeueAction: (actionId: string) => void;
}

export const useStore = create<AppState>()(
    persist(
        (set, get) => ({
            userLocation: { lat: 47.151726, lng: 27.587914 },
            targetStoreLocation: null,
            navigationMode: "indoor",
            hasEnteredStore: false,
            isTransitioningToStore: false,
            isAutoCenterEnabled: true,
            isMockGpsEnabled: true,
            route: [],
            status: "idle",
            items: [],
            backupItems: {},
            conflictItems: {},
            isOnline: navigator.onLine,
            isServerConnected: false,
            user: null,
            isAuthenticated: false,
            authChecked: false,
            token: null,
            offlineQueue: [],

            setUserLocation: (loc) => set({ userLocation: loc }),
            setTargetStoreLocation: (loc) => set({ targetStoreLocation: loc }),
            setNavigationMode: (mode) => set({ navigationMode: mode }),
            setHasEnteredStore: (value) => set({ hasEnteredStore: value }),
            setIsTransitioningToStore: (value) =>
                set({ isTransitioningToStore: value }),
            setIsAutoCenterEnabled: (value) =>
                set({ isAutoCenterEnabled: value }),
            setIsMockGpsEnabled: (value) => set({ isMockGpsEnabled: value }),
            forceIndoorMode: () => {
                set({
                    navigationMode: "indoor",
                    hasEnteredStore: true,
                    isTransitioningToStore: false,
                });
            },
            setRoute: (route) => set({ route }),
            setStatus: (status) => set({ status }),
            setOnlineStatus: (status) => set({ isOnline: status }),
            setServerConnected: (status) => set({ isServerConnected: status }),
            setItems: (items) => set({ items }),

            backupItemState: (item) =>
                set((state) => ({
                    backupItems: {
                        ...state.backupItems,
                        [item.id]: { ...item },
                    },
                })),

            toggleItemOptimistic: (itemId, newChecked) =>
                set((state) => ({
                    items: state.items.map((i) =>
                        i.id === itemId ? { ...i, checked: newChecked } : i,
                    ),
                })),

            rollbackItemState: (itemId) => {
                const backup = get().backupItems[itemId];
                if (backup) {
                    set((state) => {
                        const newBackupItems = { ...state.backupItems };
                        delete newBackupItems[itemId];
                        return {
                            items: state.items.map((i) =>
                                i.id === itemId ? { ...backup } : i,
                            ),
                            backupItems: newBackupItems,
                        };
                    });
                }
            },

            setItemConflict: (itemId, hasConflict) =>
                set((state) => ({
                    conflictItems: {
                        ...state.conflictItems,
                        [itemId]: hasConflict,
                    },
                })),

            setAuth: (user, token) => {
                const isUser = (u: unknown): u is { email: string } =>
                    typeof u === "object" && u !== null && "email" in u;

                const authenticatedUser = isUser(user)
                    ? (user as AppState["user"])
                    : null;

                set({
                    user: authenticatedUser,
                    isAuthenticated: isUser(user),
                    authChecked: true,
                    token: token === undefined ? get().token : token,
                });
            },

            enqueueAction: (action) =>
                set((state) => ({
                    offlineQueue: [...state.offlineQueue, action],
                })),

            dequeueAction: (actionId) =>
                set((state) => ({
                    offlineQueue: state.offlineQueue.filter(
                        (a) => a.id !== actionId,
                    ),
                })),
        }),
        {
            name: "p2p-shopping-storage",
            partialize: (state) => ({
                user: state.user,
                isAuthenticated: state.isAuthenticated,
                token: state.token,
                offlineQueue: state.offlineQueue,
            }),
        },
    ),
);
