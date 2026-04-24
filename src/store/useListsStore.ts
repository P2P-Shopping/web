import { create } from "zustand";
import type { Item, ShoppingList } from "../types";

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
    items?: ApiItem[];
}

interface ListsState {
    lists: ShoppingList[];
    currentList: ShoppingList | null;
    isLoading: boolean;
    error: string | null;
    isModalOpen: boolean;
    fetchLists: () => Promise<void>;
    addList: (name: string) => Promise<ShoppingList | null>;
    updateList: (id: string, updates: Partial<ShoppingList>) => void;
    deleteList: (id: string) => Promise<boolean>;
    setCurrentList: (list: ShoppingList | null) => void;
    addItem: (listId: string, item: Omit<Item, "id">) => Promise<boolean>;
    toggleItem: (listId: string, itemId: string) => Promise<boolean>;
    deleteItem: (listId: string, itemId: string) => Promise<boolean>;
    openModal: () => void;
    closeModal: () => void;
    getListById: (id: string) => ShoppingList | undefined;
}

const getBaseUrl = () =>
    import.meta.env.VITE_API_URL ||
    import.meta.env.VITE_API_BASE_URL ||
    "http://localhost:8081";

const getAuthHeaders = (withContentType = false): HeadersInit => {
    return {
        ...(withContentType ? { "Content-Type": "application/json" } : {}),
    };
};

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

const normalizeListFromApi = (list: ApiShoppingList): ShoppingList => ({
    id: list.id,
    name: list.title,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: "active",
    ownerName: "Tu",
    items: (list.items ?? []).map(normalizeItem),
});

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

    fetchLists: async () => {
        set({ isLoading: true, error: null });
        try {
            const response = await fetch(`${getBaseUrl()}/api/lists`, {
                headers: getAuthHeaders(),
                credentials: "include",
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch lists (${response.status})`);
            }

            const data = (await response.json()) as ApiShoppingList[];
            set({
                lists: Array.isArray(data)
                    ? data.map(normalizeListFromApi)
                    : [],
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

    addList: async (name: string) => {
        set({ isLoading: true, error: null });
        try {
            const trimmedName = name.trim();
            if (!trimmedName) {
                throw new Error("List name cannot be empty");
            }

            const response = await fetch(`${getBaseUrl()}/api/lists`, {
                method: "POST",
                headers: getAuthHeaders(true),
                body: JSON.stringify({ title: trimmedName }),
                credentials: "include",
            });

            if (!response.ok) {
                throw new Error(`Failed to create list (${response.status})`);
            }

            const createdList = normalizeListFromApi(
                (await response.json()) as ApiShoppingList,
            );

            set((state) => ({
                lists: [createdList, ...state.lists],
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

    updateList: (id: string, updates: Partial<ShoppingList>) => {
        set((state) => ({
            lists: state.lists.map((list) =>
                list.id === id ? { ...list, ...updates } : list,
            ),
        }));
    },

    deleteList: async (id: string) => {
        try {
            const response = await fetch(`${getBaseUrl()}/api/lists/${id}`, {
                method: "DELETE",
                headers: getAuthHeaders(),
                credentials: "include",
            });

            if (!response.ok) {
                throw new Error(`Failed to delete list (${response.status})`);
            }

            set((state) => ({
                lists: state.lists.filter((list) => list.id !== id),
                currentList:
                    state.currentList?.id === id ? null : state.currentList,
                error: null,
            }));
            return true;
        } catch (error) {
            set({
                error:
                    error instanceof Error
                        ? error.message
                        : "Failed to delete list",
            });
            return false;
        }
    },

    setCurrentList: (list: ShoppingList | null) => {
        set({ currentList: list });
    },

    addItem: async (listId: string, item: Omit<Item, "id">) => {
        try {
            const response = await fetch(
                `${getBaseUrl()}/api/lists/${listId}/items`,
                {
                    method: "POST",
                    headers: getAuthHeaders(true),
                    body: JSON.stringify(buildItemRequest(item)),
                    credentials: "include",
                },
            );

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
                    headers: getAuthHeaders(true),
                    body: JSON.stringify(
                        buildItemRequest({ ...item, checked: nextChecked }),
                    ),
                    credentials: "include",
                },
            );

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

    deleteItem: async (listId: string, itemId: string) => {
        try {
            const response = await fetch(
                `${getBaseUrl()}/api/items/${itemId}`,
                {
                    method: "DELETE",
                    headers: getAuthHeaders(),
                    credentials: "include",
                },
            );

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

    openModal: () => set({ isModalOpen: true }),
    closeModal: () => set({ isModalOpen: false }),

    getListById: (id: string) => get().lists.find((list) => list.id === id),
}));
