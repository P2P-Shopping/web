import { create } from "zustand";

/**
 * Coordinate represents a physical geographical point.
 */
export type Coordinate = { lat: number; lng: number };

/**
 * Physical point along a generated traversal route.
 */
export interface RoutePoint {
  itemId: string;
  name: string;
  lat: number;
  lng: number;
}

/**
 * Core interface defining a single shopping list item.
 */
export interface Item {
  id: string;
  name: string;
  checked: boolean;
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

  /** Active items present in the user's current shopping list. */
  items: Item[];
  
  /** 
   * Registry containing the IDs of items currently in-flight/pending confirmation, 
   * used to block stale HTTP responses from rolling back optimistic UI updates.
   */
  pendingMutations: Set<string>;
  
  /** Dictionary of items that have a conflict (currently in rollback state). */
  conflictItems: Record<string, boolean>;
  /** Dictionary where backups are maintained before optimistic local updates. */
  itemBackups: Record<string, ItemStateBackup>;

  /** Toggles an item optimistically and adds it to pendingMutations. */
  toggleItemOptimistic: (itemId: string, newChecked: boolean) => void;
  
  /** Merges fetched items from REST GET calls intelligently applying "Pending Lock". */
  setItemsFromFetch: (fetchedItems: Item[]) => void;
  
  /** Validates STOMP WebSocket broadcast and unlocks items. */
  handleItemSyncBroadcast: (itemId: string, checkedStatus: boolean) => void;

  /** Adds completely new item to the store directly. */
  addItemLocal: (item: Item) => void;

  /** Retrieves the latest backup state for an item. */
  getBackupItemState: (itemId: string) => ItemStateBackup | undefined;

  /** Stores a backup of an item. */
  backupItemState: (item: ItemStateBackup) => void;
  /** Restores the backup snapshot of an item if a transaction failed, and unlocks it. */
  rollbackItemState: (itemId: string) => void;
  /** Toggles the temporary conflict UI warning flag for an item. */
  setItemConflict: (itemId: string, hasConflict: boolean) => void;

  /** Sets the user location. */
  setUserLocation: (loc: Coordinate) => void;
  /** Mounts an updated navigation route. */
  setRoute: (route: RoutePoint[]) => void;
  /** Sets global operation status. */
  setStatus: (status: string) => void;
}

/**
 * Global application store hook using Zustand.
 */
export const useStore = create<AppState>((set, get) => ({
  userLocation: { lat: 47.151726, lng: 27.587914 },
  route: [],
  status: "idle",

  items: [],
  pendingMutations: new Set(),
  conflictItems: {},
  itemBackups: {},

  /**
   * Toggles the checked status of an item optimistically for immediate UI feedback.
   * Locks the item using `pendingMutations` to prevent stale REST overwrites.
   * @param {string} itemId - The ID of the item being checked/unchecked.
   * @param {boolean} newChecked - The new boolean property intended for the item.
   */
  toggleItemOptimistic: (itemId: string, newChecked: boolean) => set((state) => {
    const updatedItems = state.items.map((i) => 
      i.id === itemId ? { ...i, checked: newChecked } : i
    );
    const newMutations = new Set(state.pendingMutations);
    newMutations.add(itemId);
    return {
      items: updatedItems,
      pendingMutations: newMutations
    };
  }),

  /**
   * Updates the global items array via HTTP GET background fetch operations.
   * Bypasses the overwrite sequence for any items currently engaged in a WebSocket mutation.
   * @param {Item[]} fetchedItems - The JSON payload fetched containing the shopping list payload.
   */
  setItemsFromFetch: (fetchedItems: Item[]) => set((state) => {
    // Apply "Pending Lock" Pattern: skip merging over items present in pendingMutations.
    // If the server claims an item is false, but local pending says true, ignore the server (for now).
    const resolvedItems = fetchedItems.map((fetchedItem) => {
      if (state.pendingMutations.has(fetchedItem.id)) {
        // Recover our local state, blocking the stale DB fetch.
        const activeLocal = state.items.find((i) => i.id === fetchedItem.id);
        return activeLocal ? activeLocal : fetchedItem;
      }
      return fetchedItem;
    });

    // Also preserve optimistic items that might not have committed to the DB yet at all!
    const pureOptimisticAdditions = state.items.filter(
      (local) => state.pendingMutations.has(local.id) && !fetchedItems.some((m) => m.id === local.id)
    );

    return { items: [...resolvedItems, ...pureOptimisticAdditions] };
  }),

  /**
   * Cleans an item from pending mutations and safely injects the officially broadcasted WebSocket state
   * into the component hierarchy.
   * @param {string} itemId - The ID corresponding to the STOMP message payload.
   * @param {boolean} checkedStatus - The official state distributed universally by the backend.
   */
  handleItemSyncBroadcast: (itemId: string, checkedStatus: boolean) => set((state) => {
    const updatedItems = state.items.map((i) => 
      i.id === itemId ? { ...i, checked: checkedStatus } : i
    );
    const newMutations = new Set(state.pendingMutations);
    newMutations.delete(itemId);
    return {
      items: updatedItems,
      pendingMutations: newMutations
    };
  }),

  /**
   * Standard list injector for freshly keyed items (when pressing Add).
   * @param {Item} item - Completely structured local instance to append.
   */
  addItemLocal: (item: Item) => set((state) => ({
    items: [...state.items, item]
  })),

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
   * Restores an optimistic update back to its previously recorded configuration safely.
   * Performs an immediate removal of its pending lock registry.
   * @param {string} itemId - The ID of the item experiencing rollback.
   */
  rollbackItemState: (itemId: string) => set((state) => {
    const backupNode = state.itemBackups[itemId];
    let updatedItems = state.items;

    // Apply the backup state directly to the array instance if it exists.
    if (backupNode) {
      updatedItems = state.items.map((i) => 
        i.id === itemId ? { ...i, ...backupNode } : i
      );
    }
    
    const { [itemId]: _removed, ...restBackups } = state.itemBackups;
    
    // Extinguish lock registry
    const newMutations = new Set(state.pendingMutations);
    newMutations.delete(itemId);

    return { 
      itemBackups: restBackups,
      items: updatedItems,
      pendingMutations: newMutations
    };
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
