// ============================================
// ZUSTAND STORE - Shopping Lists State Management
// ============================================

import { create } from "zustand";
import type { ShoppingList, Item } from "../types";

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
    addList: (name: string) => Promise<void>;
    updateList: (id: string, updates: Partial<ShoppingList>) => Promise<void>;
    deleteList: (id: string) => Promise<void>;
    setCurrentList: (list: ShoppingList | null) => void;

    // Actions - Items (within current list)
    addItem: (listId: string, item: Omit<Item, "id">) => Promise<void>;
    toggleItem: (listId: string, itemId: string) => Promise<void>;
    deleteItem: (listId: string, itemId: string) => Promise<void>;

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
            // TODO: Replace with actual API call when backend is ready
            // const response = await fetch(`${import.meta.env.VITE_API_URL}/api/lists`);
            // const data = await response.json();

            // Mock delay to simulate API
            await new Promise((resolve) => setTimeout(resolve, 500));
            set({ lists: MOCK_LISTS, isLoading: false });
        } catch (error) {
            console.error("Failed to fetch lists:", error);
            set({ error: "Failed to fetch lists", isLoading: false });
        }
    },

    // Add new list
    addList: async (name: string) => {
        set({ isLoading: true, error: null });
        try {
            // TODO: Replace with actual API call
            // await axios.post(`${import.meta.env.VITE_API_URL}/api/lists`, { name });

            const newList: ShoppingList = {
                id: crypto.randomUUID(),
                name,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                status: "active",
                items: [],
                ownerName: "Tu",
            };

            await new Promise((resolve) => setTimeout(resolve, 300));
            set((state) => ({
                lists: [newList, ...state.lists],
                isLoading: false,
                isModalOpen: false,
            }));
        } catch (error) {
            console.error("Failed to create list:", error);
            set({ error: "Failed to create list", isLoading: false });
        }
    },

    // Update existing list
    updateList: async (id: string, updates: Partial<ShoppingList>) => {
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
        set((state) => ({
            lists: state.lists.filter((list) => list.id !== id),
        }));
    },

    // Set current list for detail view
    setCurrentList: (list: ShoppingList | null) => {
        set({ currentList: list });
    },

    // Add item to a list
    addItem: async (listId: string, item: Omit<Item, "id">) => {
        const newItem: Item = { ...item, id: crypto.randomUUID() };
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
    toggleItem: async (listId: string, itemId: string) => {
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
    deleteItem: async (listId: string, itemId: string) => {
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
