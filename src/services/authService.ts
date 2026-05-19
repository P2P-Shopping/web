import { useStore } from "../context/useStore";
import api from "./api";

export const loginRequest = async (email: string, password: string) => {
    const response = await api.post(
        "/api/auth/login",
        { email, password },
        {
            headers: {
                "X-Return-Token": "true",
            },
        },
    );
    
    // Extragem tokenul și datele utilizatorului din răspuns
    const { token, ...userData } = response.data;
    
    // Îl salvăm în store ca interceptorul din api.ts să îl trimită la următoarele request-uri
    if (token) {
        useStore.getState().setAuth(token, userData);
    }
    
    return response.data;
};

export const registerRequest = async (data: Record<string, unknown>) => {
    const response = await api.post("/api/auth/register", data);
    return response.data;
};

export const checkAuthRequest = async () => {
    try {
        const response = await api.get("/api/auth/me", {
            headers: {
                "X-Return-Token": "true",
            },
        });
        
        const { token, ...userData } = response.data;
        if (token) {
            useStore.getState().setAuth(token, userData);
        }
        
        return response.data;
    } catch {
        // Silently fail auth check as it's expected when not logged in
        return null;
    }
};

export const logoutRequest = async () => {
    try {
        await api.post("/api/auth/logout", {});
        useStore.getState().setAuth(null, null);
    } catch (error) {
        console.error("Logout request failed:", error);
        useStore.getState().setAuth(null, null);
        throw error;
    }
};