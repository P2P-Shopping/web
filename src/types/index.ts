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
    // Alias for isChecked (API uses checked)
    isChecked?: boolean;
}

export interface ShoppingList {
    id: string;
    name: string;
    createdAt: string;
    updatedAt: string;
    status: "active" | "completed" | "archived";
    items: Item[];
    // User relation
    userId?: string;
    ownerName?: string;
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
