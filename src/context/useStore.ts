import { create } from "zustand";

type Coordinate = { lat: number; lng: number };

export interface RoutePoint {
  itemId: string;
  name: string;
  lat: number;
  lng: number;
}

/**
 * State snapshot of an item maintained for rollback purposes.
 */
export interface ItemStateBackup {
  id: string;
  name: string;
  checked: boolean;
}

/**
 * Structure of the global application store.
 */
interface AppState {
  userLocation: Coordinate;
  route: RoutePoint[];
  status: string;
  
  /** Dictionary of items that have a conflict (currently in rollback state). */
  conflictItems: Record<string, boolean>;
  /** Dictionary where backups are maintained before optimistic local updates. */
  itemBackups: Record<string, ItemStateBackup>;
  
  /** Retrieves the latest backup state for an item. */
  getBackupItemState: (itemId: string) => ItemStateBackup | undefined;

  /** Stores a backup of an item. */
  backupItemState: (item: ItemStateBackup) => void;
  /** Restores the backup snapshot of an item if a transaction failed. */
  rollbackItemState: (itemId: string) => void;
  /** Toggles the temporary conflict UI warning flag for an item. */
  setItemConflict: (itemId: string, hasConflict: boolean) => void;

  setUserLocation: (loc: Coordinate) => void;
  setRoute: (route: RoutePoint[]) => void;
  setStatus: (status: string) => void;
}

/**
 * Global application store hook using Zustand.
 */
export const useStore = create<AppState>((set, get) => ({
  userLocation: { lat: 47.151726, lng: 27.587914 },
  route: [],
  status: "idle",
  conflictItems: {},
  itemBackups: {},

  /**
   * Gets the last known backup of an item for its ID.
   * @param {string} itemId - The target item's ID.
   * @returns {ItemStateBackup | undefined} The backup state if it exists.
   */
  getBackupItemState: (itemId: string) => {
    return get().itemBackups[itemId];
  },

  /**
   * Appends the given item state to the backups map.
   * @param {ItemStateBackup} item - The item backup snapshot.
   */
  backupItemState: (item: ItemStateBackup) => set((state) => ({
    itemBackups: { ...state.itemBackups, [item.id]: { ...item } }
  })),

  /**
   * Intended to find the backup for the itemId and clear it from active backups
   * indicating the rollback event was processed.
   * @param {string} itemId - The ID of the item being reverted.
   */
  rollbackItemState: (itemId: string) => set((state) => {
    const { [itemId]: _removed, ...restBackups } = state.itemBackups;
    return { itemBackups: restBackups };
  }),

  /**
   * Sets or unsets the visual conflict presence on an item.
   * @param {string} itemId - The target item.
   * @param {boolean} hasConflict - Flag denoting conflict presence.
   */
  setItemConflict: (itemId: string, hasConflict: boolean) => set((state) => ({
    conflictItems: { ...state.conflictItems, [itemId]: hasConflict }
  })),

  /**
   * Sets the user location.
   * @param {Coordinate} loc - The new location coordinate.
   */
  setUserLocation: (loc) => set({ userLocation: loc }),
  
  /**
   * Mounts an updated navigation route.
   * @param {RoutePoint[]} route - The new traversal route.
   */
  setRoute: (route) => set({ route }),
  
  /**
   * Sets global operation status.
   * @param {string} status - New valid status string.
   */
  setStatus: (status) => set({ status }),
}));
