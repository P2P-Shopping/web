import { create } from "zustand";
import { persist } from "zustand/middleware";

type Coordinate = { lat: number; lng: number };

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
    /** Updates user location */
    setUserLocation: (loc: Coordinate) => void;
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
}

export const useStore = create<AppState>()(
    persist(
        (set, get) => ({
            userLocation: { lat: 47.151726, lng: 27.587914 },
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
            setUserLocation: (loc) => set({ userLocation: loc }),
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
                    token: token !== undefined ? token : get().token,
                });
            },
        }),
        {
            name: "p2p-shopping-storage",
            partialize: (state) => ({
                user: state.user,
                isAuthenticated: state.isAuthenticated,
            }),
        },
    ),
);
