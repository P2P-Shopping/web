import { create } from "zustand";
import { useStore } from "../context/useStore";
import type { Item, ListCategory, ShoppingList } from "../types";

interface ApiItem {
    id: string;
    name: string;
    isChecked?: boolean;
    brand?: string;
    quantity?: string;
    category?: string;
    price?: number;
    isRecurrent?: boolean;
}

interface ApiShoppingList {
    id: string;
    title: string;
    category?: ListCategory;
    subcategory?: string;
    finalStore?: string;
    createdAt?: string;
    updatedAt?: string;
    items?: ApiItem[];
    ownerName?: string;
    ownerEmail?: string;
    userId?: string;
    collaboratorEmails?: string[];
}

interface ListsState {
    lists: ShoppingList[];
    currentList: ShoppingList | null;
    isLoading: boolean;
    error: string | null;
    isModalOpen: boolean;
    deletingListId: string | null;
    fetchLists: () => Promise<void>;
    addList: (
        name: string,
        category?: ListCategory,
    ) => Promise<ShoppingList | null>;
    updateList: (id: string, updates: Partial<ShoppingList>) => void;
    deleteList: (id: string) => Promise<boolean>;
    renameList: (id: string, newName: string) => Promise<boolean>;
    setCurrentList: (list: ShoppingList | null) => void;
    addItem: (listId: string, item: Omit<Item, "id">) => Promise<boolean>;
    toggleItem: (listId: string, itemId: string) => Promise<boolean>;
    deleteItem: (listId: string, itemId: string) => Promise<boolean>;
    shareList: (listId: string, email: string) => Promise<boolean>;
    openModal: () => void;
    closeModal: () => void;
    getListById: (id: string) => ShoppingList | undefined;
    clearLists: () => void;
}

const pickCurrentNormalList = (lists: ShoppingList[]) =>
    [...lists]
        .filter((list) => (list.category ?? "NORMAL") === "NORMAL")
        .sort(
            (left, right) =>
                new Date(right.updatedAt).getTime() -
                new Date(left.updatedAt).getTime(),
        )[0] ?? null;

/**
 * Resolves the base URL for API requests from environment variables.
 * @returns The base URL string.
 */
const getBaseUrl = () => {
    const base =
        import.meta.env.VITE_API_URL ||
        import.meta.env.VITE_API_BASE_URL ||
        "http://localhost:8081";
    return base === "/" ? "" : base;
};

/**
 * Constructs standard headers for API requests.
 */
const jsonHeaders = (withContentType = false): HeadersInit => {
    return {
        ...(withContentType ? { "Content-Type": "application/json" } : {}),
    };
};

/**
 * Handles common response scenarios like 401 Unauthorized.
 */
const handleAuthResponse = (response: Response) => {
    if (response.status === 401) {
        useStore.getState().setAuth(null);
        useListsStore.getState().clearLists();
        throw new Error("Session expired. Please log in again.");
    }
    return response;
};

/**
 * Converts an item from the API format to the internal application format.
 * @param item - The raw API item data.
 * @returns A formatted Item object.
 */
const normalizeItem = (item: ApiItem): Item => ({
    id: item.id,
    name: item.name,
    checked: Boolean(item.isChecked),
    brand: item.brand,
    quantity: item.quantity,
    category: item.category,
    price: item.price,
    isRecurrent: item.isRecurrent,
});

/**
 * Normalizes the raw list data from the API into the application's ShoppingList format.
 * @param list - The raw API shopping list data.
 * @returns A formatted ShoppingList object.
 */
const normalizeListFromApi = (list: ApiShoppingList): ShoppingList => ({
    id: list.id,
    name: list.title,
    createdAt: list.createdAt ?? new Date().toISOString(),
    updatedAt: list.updatedAt ?? list.createdAt ?? new Date().toISOString(),
    status: "active",
    category: list.category ?? "NORMAL",
    subcategory: list.subcategory,
    finalStore: list.finalStore,
    ownerName: list.ownerName || "You",
    ownerEmail: list.ownerEmail,
    userId: list.userId,
    collaboratorEmails: list.collaboratorEmails ?? [],
    items: (list.items ?? []).map(normalizeItem),
});

/**
 * Formats a partial item object into the payload expected by the API.
 * @param item - Partial item data to be formatted.
 * @returns The API-ready request payload.
 */
const buildItemRequest = (item: Partial<Item>) => ({
    name: item.name ?? "",
    isChecked: Boolean(item.checked),
    brand: item.brand ?? null,
    quantity: item.quantity ?? null,
    price: item.price ?? null,
    category: item.category ?? null,
    isRecurrent: Boolean(item.isRecurrent),
    timestamp: Date.now(),
});

export const useListsStore = create<ListsState>((set, get) => ({
    lists: [],
    currentList: null,
    isLoading: false,
    error: null,
    isModalOpen: false,
    deletingListId: null,

    /**
     * Fetches all shopping lists for the current user from the backend API.
     */
    fetchLists: async () => {
        set({ isLoading: true, error: null });
        try {
            const response = await fetch(`${getBaseUrl()}/api/lists`, {
                headers: jsonHeaders(),
                credentials: "include",
            });

            handleAuthResponse(response);

            if (!response.ok) {
                throw new Error(`Failed to fetch lists (${response.status})`);
            }

            const data = (await response.json()) as ApiShoppingList[];
            const normalizedLists = Array.isArray(data)
                ? data.map(normalizeListFromApi)
                : [];
            set({
                lists: normalizedLists,
                currentList: pickCurrentNormalList(normalizedLists),
                isLoading: false,
            });
        } catch (error) {
            set({
                error:
                    error instanceof Error
                        ? error.message
                        : "Failed to fetch lists",
                isLoading: false,
            });
        }
    },

    /**
     * Creates a new shopping list via the API and updates the local store.
     * @param name - The title of the new list.
     * @returns The newly created list or null if creation failed.
     */
    addList: async (name: string, category: ListCategory = "NORMAL") => {
        set({ isLoading: true, error: null });
        try {
            const trimmedName = name.trim();
            if (!trimmedName) {
                throw new Error("List name cannot be empty");
            }

            // Prevent creating multiple NORMAL lists (only one "Your basket" allowed)
            if (category === "NORMAL") {
                const state = get();
                const hasNormalList = state.lists.some(
                    (list) => (list.category ?? "NORMAL") === "NORMAL",
                );
                if (hasNormalList) {
                    set({ isLoading: false });
                    throw new Error(
                        "You can only have one shopping list. Use 'Your basket' or create a Recipe/Frequent list.",
                    );
                }
            }

            const response = await fetch(`${getBaseUrl()}/api/lists`, {
                method: "POST",
                headers: jsonHeaders(true),
                body: JSON.stringify({ title: trimmedName, category }),
                credentials: "include",
            });

            handleAuthResponse(response);

            if (!response.ok) {
                throw new Error(`Failed to create list (${response.status})`);
            }

            const createdList = normalizeListFromApi(
                (await response.json()) as ApiShoppingList,
            );

            set((state) => ({
                lists: [createdList, ...state.lists],
                currentList:
                    (createdList.category ?? "NORMAL") === "NORMAL"
                        ? createdList
                        : state.currentList,
                isLoading: false,
                isModalOpen: false,
            }));
            return createdList;
        } catch (error) {
            set({
                error:
                    error instanceof Error
                        ? error.message
                        : "Failed to create list",
                isLoading: false,
            });
            return null;
        }
    },

    /**
     * Updates a shopping list locally in the state.
     * @param id - The ID of the list to update.
     * @param updates - The partial data to update.
     */
    updateList: (id: string, updates: Partial<ShoppingList>) => {
        set((state) => {
            const nextLists = state.lists.map((list) =>
                list.id === id ? { ...list, ...updates } : list,
            );
            return {
                lists: nextLists,
                currentList: pickCurrentNormalList(nextLists),
            };
        });
    },

    /**
     * Deletes a shopping list via the API and removes it from the local store.
     * @param id - The ID of the list to delete.
     * @returns True if successful, false otherwise.
     */
    deleteList: async (id: string) => {
        set({ deletingListId: id, error: null });
        try {
            const response = await fetch(`${getBaseUrl()}/api/lists/${id}`, {
                method: "DELETE",
                headers: jsonHeaders(),
                credentials: "include",
            });

            handleAuthResponse(response);

            if (!response.ok) {
                throw new Error(`Failed to delete list (${response.status})`);
            }

            set((state) => ({
                lists: state.lists.filter((list) => list.id !== id),
                currentList: pickCurrentNormalList(
                    state.lists.filter((list) => list.id !== id),
                ),
                error: null,
                isLoading: false,
                deletingListId: null,
            }));
            return true;
        } catch (error) {
            set({
                error:
                    error instanceof Error
                        ? error.message
                        : "Failed to delete list",
                isLoading: false,
                deletingListId: null,
            });
            return false;
        }
    },

    /**
     * Renames a shopping list via the API and updates the local store.
     * @param id - The ID of the list to rename.
     * @param newName - The new name for the list.
     * @returns True if successful, false otherwise.
     */
    renameList: async (id: string, newName: string) => {
        const trimmedName = newName.trim();
        if (!trimmedName) {
            set({ error: "List name cannot be empty" });
            return false;
        }

        set({ error: null });
        try {
            const response = await fetch(`${getBaseUrl()}/api/lists/${id}`, {
                method: "PUT",
                headers: jsonHeaders(true),
                body: JSON.stringify({ title: trimmedName }),
                credentials: "include",
            });

            handleAuthResponse(response);

            if (!response.ok) {
                throw new Error(`Failed to rename list (${response.status})`);
            }

            set((state) => ({
                lists: state.lists.map((list) =>
                    list.id === id ? { ...list, name: trimmedName } : list,
                ),
                currentList:
                    state.currentList?.id === id
                        ? { ...state.currentList, name: trimmedName }
                        : state.currentList,
                error: null,
            }));
            return true;
        } catch (error) {
            set({
                error:
                    error instanceof Error
                        ? error.message
                        : "Failed to rename list",
            });
            return false;
        }
    },

    /**
     * Sets the currently active shopping list in the application state.
     * @param list - The list to set as active, or null to clear it.
     */
    setCurrentList: (list: ShoppingList | null) => {
        set({ currentList: list });
    },

    /**
     * Adds a new item to a specific shopping list via the API.
     * @param listId - The ID of the list to add the item to.
     * @param item - The item details (excluding ID).
     * @returns True if successful, false otherwise.
     */
    addItem: async (listId: string, item: Omit<Item, "id">) => {
        try {
            const response = await fetch(
                `${getBaseUrl()}/api/lists/${listId}/items`,
                {
                    method: "POST",
                    headers: jsonHeaders(true),
                    body: JSON.stringify(buildItemRequest(item)),
                    credentials: "include",
                },
            );

            handleAuthResponse(response);

            if (!response.ok) {
                throw new Error(`Failed to add item (${response.status})`);
            }

            const createdItem = normalizeItem(
                (await response.json()) as ApiItem,
            );
            set((state) => ({
                lists: state.lists.map((list) =>
                    list.id === listId
                        ? { ...list, items: [...list.items, createdItem] }
                        : list,
                ),
            }));
            return true;
        } catch (error) {
            set({
                error:
                    error instanceof Error
                        ? error.message
                        : "Failed to add item",
            });
            return false;
        }
    },

    /**
     * Toggles the checked status of a specific item via the API.
     * @param listId - The ID of the list containing the item.
     * @param itemId - The ID of the item to toggle.
     * @returns True if successful, false otherwise.
     */
    toggleItem: async (listId: string, itemId: string) => {
        const list = get().lists.find((entry) => entry.id === listId);
        const item = list?.items.find((entry) => entry.id === itemId);
        if (!item) {
            return false;
        }

        const nextChecked = !item.checked;
        try {
            const response = await fetch(
                `${getBaseUrl()}/api/items/${itemId}`,
                {
                    method: "PUT",
                    headers: jsonHeaders(true),
                    body: JSON.stringify(
                        buildItemRequest({ ...item, checked: nextChecked }),
                    ),
                    credentials: "include",
                },
            );

            handleAuthResponse(response);

            if (!response.ok) {
                throw new Error(`Failed to update item (${response.status})`);
            }

            const updatedItem = normalizeItem(
                (await response.json()) as ApiItem,
            );
            set((state) => ({
                lists: state.lists.map((entry) =>
                    entry.id === listId
                        ? {
                              ...entry,
                              items: entry.items.map((current) =>
                                  current.id === itemId ? updatedItem : current,
                              ),
                          }
                        : entry,
                ),
            }));
            return true;
        } catch (error) {
            set({
                error:
                    error instanceof Error
                        ? error.message
                        : "Failed to update item",
            });
            return false;
        }
    },

    /**
     * Deletes a specific item from a shopping list via the API.
     * @param listId - The ID of the list containing the item.
     * @param itemId - The ID of the item to delete.
     * @returns True if successful, false otherwise.
     */
    deleteItem: async (listId: string, itemId: string) => {
        try {
            const response = await fetch(
                `${getBaseUrl()}/api/items/${itemId}`,
                {
                    method: "DELETE",
                    headers: jsonHeaders(),
                    credentials: "include",
                },
            );

            handleAuthResponse(response);

            if (!response.ok) {
                throw new Error(`Failed to delete item (${response.status})`);
            }

            set((state) => ({
                lists: state.lists.map((entry) =>
                    entry.id === listId
                        ? {
                              ...entry,
                              items: entry.items.filter(
                                  (current) => current.id !== itemId,
                              ),
                          }
                        : entry,
                ),
            }));
            return true;
        } catch (error) {
            set({
                error:
                    error instanceof Error
                        ? error.message
                        : "Failed to delete item",
            });
            return false;
        }
    },

    /**
     * Shares a shopping list with another user by email.
     */
    shareList: async (listId: string, email: string) => {
        try {
            const response = await fetch(
                `${getBaseUrl()}/api/lists/${listId}/share`,
                {
                    method: "POST",
                    headers: jsonHeaders(true),
                    body: JSON.stringify({ email }),
                    credentials: "include",
                },
            );

            handleAuthResponse(response);

            if (!response.ok) {
                const errorData = (await response.json().catch(() => ({}))) as {
                    message?: string;
                };
                throw new Error(
                    errorData.message ||
                        `Failed to share list (${response.status})`,
                );
            }

            return true;
        } catch (error) {
            set({
                error:
                    error instanceof Error
                        ? error.message
                        : "Failed to share list",
            });
            return false;
        }
    },

    /** Opens the 'Create List' modal. */
    openModal: () => set({ isModalOpen: true }),

    /** Closes the 'Create List' modal. */
    closeModal: () => set({ isModalOpen: false }),

    /**
     * Retrieves a specific shopping list by its ID from the local state.
     * @param id - The ID of the list to retrieve.
     * @returns The matching shopping list or undefined.
     */
    getListById: (id: string) => get().lists.find((list) => list.id === id),

    /** Clears all lists from the store and resets state. */
    clearLists: () => set({ lists: [], currentList: null, error: null }),
}));
