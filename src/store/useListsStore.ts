// ============================================
// ZUSTAND STORE - Shopping Lists State Management
// ============================================

import { create } from "zustand";
import type { Item, ShoppingList } from "../types";
import { uuid } from "../utils/uuid";

const USE_MOCK_LISTS =
    import.meta.env.DEV || import.meta.env.VITE_ENABLE_MOCK_LISTS === "true";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const normalizeListFromApi = (list: ShoppingList & { items?: Item[] }) => ({
    ...list,
    items: (list.items ?? []).map((item) => ({
        ...item,
        checked: Boolean(item.checked),
    })),
});

// Mock data for development (without backend)
const MOCK_LISTS: ShoppingList[] = [
    {
        id: "1",
        name: "Săptămâna asta",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: "active",
        items: [
            {
                id: "1",
                name: "Lapte de ovăz",
                checked: false,
                quantity: "1L",
                category: "Lactate",
            },
            {
                id: "2",
                name: "Pâine integrală",
                checked: false,
                quantity: "1",
                category: "Panificație",
            },
            {
                id: "3",
                name: "Roșii cherry",
                checked: false,
                quantity: "500g",
                category: "Legume",
            },
        ],
        ownerName: "Adrian Hordila",
    },
    {
        id: "2",
        name: "Rețete Weekend",
        createdAt: new Date(Date.now() - 86400000).toISOString(),
        updatedAt: new Date(Date.now() - 86400000).toISOString(),
        status: "active",
        items: [
            {
                id: "4",
                name: "Făină",
                checked: false,
                quantity: "1kg",
                category: "Cereale",
            },
            {
                id: "5",
                name: "Ouă",
                checked: false,
                quantity: "10",
                category: "Lactate",
            },
            {
                id: "6",
                name: "Lapte",
                checked: false,
                quantity: "1L",
                category: "Lactate",
            },
        ],
        ownerName: "Maria Popescu",
    },
];

interface ListsState {
    // State
    lists: ShoppingList[];
    currentList: ShoppingList | null;
    isLoading: boolean;
    error: string | null;
    isModalOpen: boolean;

    // Actions - Lists
    fetchLists: () => Promise<void>;
    addList: (name: string) => Promise<boolean>;
    updateList: (id: string, updates: Partial<ShoppingList>) => void;
    deleteList: (id: string) => Promise<boolean>;
    setCurrentList: (list: ShoppingList | null) => void;

    // Actions - Items (within current list)
    addItem: (listId: string, item: Omit<Item, "id">) => void;
    toggleItem: (listId: string, itemId: string) => void;
    deleteItem: (listId: string, itemId: string) => void;

    // Actions - Modal
    openModal: () => void;
    closeModal: () => void;

    // Helpers
    getListById: (id: string) => ShoppingList | undefined;
}

export const useListsStore = create<ListsState>((set, get) => ({
    // Initial State
    lists: [],
    currentList: null,
    isLoading: false,
    error: null,
    isModalOpen: false,

    // Fetch all lists (with mock fallback)
    fetchLists: async () => {
        set({ isLoading: true, error: null });
        try {
            if (USE_MOCK_LISTS) {
                await delay(500);
                const existingLists = get().lists;
                const existingIds = new Set(
                    existingLists.map((list) => list.id),
                );
                const mergedLists = [
                    ...existingLists,
                    ...MOCK_LISTS.filter((list) => !existingIds.has(list.id)),
                ];

                set({
                    lists: mergedLists,
                    isLoading: false,
                });
                return;
            }

            const baseUrl =
                import.meta.env.VITE_API_URL ||
                import.meta.env.VITE_API_BASE_URL ||
                "http://localhost:8081";
            const token = localStorage.getItem("token");
            const headers: HeadersInit = {
                "Content-Type": "application/json",
            };
            if (token) {
                headers.Authorization = `Bearer ${token}`;
            }

            const response = await fetch(`${baseUrl}/api/lists`, { headers });
            if (!response.ok) {
                throw new Error(`Failed to fetch lists (${response.status})`);
            }

            const data = await response.json();
            const nextLists = Array.isArray(data)
                ? data.map(normalizeListFromApi)
                : [];
            set({ lists: nextLists, isLoading: false });
        } catch (error) {
            console.error("Failed to fetch lists:", error);
            set({
                error:
                    error instanceof Error
                        ? error.message
                        : "Failed to fetch lists",
                isLoading: false,
            });
        }
    },

    // Add new list
    addList: async (name: string) => {
        set({ isLoading: true, error: null });
        try {
            const trimmedName = name.trim();
            if (!trimmedName) {
                throw new Error("List name cannot be empty");
            }

            const newList: ShoppingList = {
                id: uuid(),
                name: trimmedName,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                status: "active",
                items: [],
                ownerName: "Tu",
            };

            if (!USE_MOCK_LISTS) {
                const baseUrl =
                    import.meta.env.VITE_API_URL ||
                    import.meta.env.VITE_API_BASE_URL ||
                    "http://localhost:8081";
                const token = localStorage.getItem("token");
                const response = await fetch(`${baseUrl}/api/lists`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        ...(token ? { Authorization: `Bearer ${token}` } : {}),
                    },
                    body: JSON.stringify({ name: trimmedName }),
                });

                if (!response.ok) {
                    throw new Error(
                        `Failed to create list (${response.status})`,
                    );
                }

                const createdList = await response.json();
                const normalizedList = normalizeListFromApi({
                    ...newList,
                    ...createdList,
                });
                set((state) => ({
                    lists: [normalizedList, ...state.lists],
                    isLoading: false,
                    isModalOpen: false,
                }));
                return true;
            }

            await delay(300);
            set((state) => ({
                lists: [newList, ...state.lists],
                isLoading: false,
                isModalOpen: false,
            }));
            return true;
        } catch (error) {
            console.error("Failed to create list:", error);
            set({
                error:
                    error instanceof Error
                        ? error.message
                        : "Failed to create list",
                isLoading: false,
            });
            return false;
        }
    },

    // Update existing list
    updateList: (id: string, updates: Partial<ShoppingList>) => {
        const updatedAt = new Date().toISOString();
        const updateListItem = (list: ShoppingList) => {
            if (list.id !== id) return list;
            return { ...list, ...updates, updatedAt };
        };
        set((state) => ({
            lists: state.lists.map(updateListItem),
        }));
    },

    // Delete list
    deleteList: async (id: string) => {
        const previousState = get();

        set((state) => ({
            lists: state.lists.filter((list) => list.id !== id),
            currentList:
                state.currentList?.id === id ? null : state.currentList,
            error: null,
        }));

        if (USE_MOCK_LISTS) {
            return true;
        }

        try {
            const baseUrl =
                import.meta.env.VITE_API_URL ||
                import.meta.env.VITE_API_BASE_URL ||
                "http://localhost:8081";
            const token = localStorage.getItem("token");
            const response = await fetch(`${baseUrl}/api/lists/${id}`, {
                method: "DELETE",
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
            });

            if (!response.ok) {
                throw new Error(`Failed to delete list (${response.status})`);
            }
        } catch (error) {
            console.error("Failed to delete list:", error);
            set({
                lists: previousState.lists,
                currentList: previousState.currentList,
                error:
                    error instanceof Error
                        ? error.message
                        : "Failed to delete list",
            });
            return false;
        }

        await get().fetchLists();
        return true;
    },

    // Set current list for detail view
    setCurrentList: (list: ShoppingList | null) => {
        set({ currentList: list });
    },

    // Add item to a list
    addItem: (listId: string, item: Omit<Item, "id">) => {
        const newItem: Item = { ...item, id: uuid() };
        set((state) => ({
            lists: state.lists.map((list) =>
                list.id === listId
                    ? {
                          ...list,
                          items: [...list.items, newItem],
                          updatedAt: new Date().toISOString(),
                      }
                    : list,
            ),
        }));
    },

    // Toggle item checked state
    toggleItem: (listId: string, itemId: string) => {
        const updatedAt = new Date().toISOString();
        const toggleItemInList = (list: ShoppingList) => {
            if (list.id !== listId) return list;
            const updatedItems = list.items.map((item) => {
                if (item.id !== itemId) return item;
                return { ...item, checked: !item.checked };
            });
            return { ...list, items: updatedItems, updatedAt };
        };
        set((state) => ({
            lists: state.lists.map(toggleItemInList),
        }));
    },

    // Delete item from list
    deleteItem: (listId: string, itemId: string) => {
        const updatedAt = new Date().toISOString();
        const deleteItemFromList = (list: ShoppingList) => {
            if (list.id !== listId) return list;
            const filteredItems = list.items.filter(
                (item) => item.id !== itemId,
            );
            return { ...list, items: filteredItems, updatedAt };
        };
        set((state) => ({
            lists: state.lists.map(deleteItemFromList),
        }));
    },

    // Modal controls
    openModal: () => set({ isModalOpen: true }),
    closeModal: () => set({ isModalOpen: false }),

    // Helper to get list by ID
    getListById: (id: string) => {
        return get().lists.find((list) => list.id === id);
    },
}));
