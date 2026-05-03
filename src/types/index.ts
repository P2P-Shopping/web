// ============================================
// SHARED TYPES - Centralized for entire app
// ============================================

export interface Item {
    id: string;
    name: string;
    checked: boolean;
    // Fields from Backend
    brand?: string;
    quantity?: string;
    category?: string;
    price?: number;
    isRecurrent?: boolean;
    createdAt?: number;
}

export type ListCategory = "NORMAL" | "RECIPE" | "FREQUENT";

/**
 * Supported types of actions that can be queued while offline.
 */
export type OfflineActionType = "ADD_ITEM" | "TOGGLE_ITEM" | "DELETE_ITEM";

/**
 * Represents an action that failed due to being offline and is waiting for sync.
 */
export interface QueuedAction {
    /** Unique identifier for the queued action */
    id: string;
    /** The type of action to perform */
    type: OfflineActionType;
    /** The data required to replay the action */
    payload: {
        listId: string;
        itemId?: string;
        name?: string;
        checked?: boolean;
        brand?: string;
        quantity?: string;
        price?: number;
        category?: string;
        isRecurrent?: boolean;
    };
    /** When the action was first attempted */
    timestamp: number;
}

export interface ShoppingList {
    id: string;
    name: string;
    createdAt: string;
    updatedAt: string;
    status: "active" | "completed" | "archived";
    category?: ListCategory;
    subcategory?: string;
    finalStore?: string;
    items: Item[];
    // User relation
    userId?: string;
    ownerName?: string;
    ownerEmail?: string;
    collaboratorEmails?: string[];
}

// Auth Types
export interface LoginRequest {
    email: string;
    password: string;
}

export interface RegisterRequest {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
}

export interface AuthResponse {
    message: string;
    email?: string;
    token?: string;
}

// API Response Types
export interface ApiError {
    error: string;
    message?: string;
}

export interface ApiResponse<T> {
    data?: T;
    error?: string;
}

// Navigation Types
export interface RoutePoint {
    id: string;
    name: string;
    address: string;
    latitude: number;
    longitude: number;
    order: number;
}

export interface Route {
    id: string;
    name: string;
    points: RoutePoint[];
    totalDistance: number;
    estimatedTime: number;
}
