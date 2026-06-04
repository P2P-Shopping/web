import { useStore } from "../context/useStore";
import api from "./api";

export interface AuthResponse {
    token?: string;
    [key: string]: unknown;
}

export const loginRequest = async (email: string, password: string) => {
    const response = await api.post<AuthResponse>(
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
        useStore.getState().setAuth(userData, token);
    }

    return response.data;
};

export const registerRequest = async (data: Record<string, unknown>) => {
    const response = await api.post<AuthResponse>("/api/auth/register", data);
    return response.data;
};

export const checkAuthRequest = async () => {
    try {
        // Luăm token-ul curent din store
        const currentToken = useStore.getState().token;

        // Dacă nu avem deloc token local, nu are rost să mai batem backend-ul
        if (!currentToken) return null;

        const response = await api.get<AuthResponse>("/api/auth/me", {
            headers: {
                "X-Return-Token": "true",
                Authorization: `Bearer ${currentToken}`, // Îi forțăm header-ul manual în caz că interceptorul dă rateu la init
            },
        });

        const { token, ...userData } = response.data;
        if (token) {
            useStore.getState().setAuth(userData, token);
        }

        return response.data;
    } catch (error) {
        console.log("Auth check failed, keeping local session active.", error);
        // În loc de return null care te dă afară, returnăm starea curentă din store ca să nu te deconecteze
        return useStore.getState().user;
    }
};

export const googleLoginRequest = async (credential: string) => {
    const response = await api.post<AuthResponse>(
        "/api/auth/google",
        { credential },
        { headers: { "X-Return-Token": "true" } },
    );
    const { token, ...userData } = response.data;
    if (token) {
        useStore.getState().setAuth(userData, token);
    }
    return response.data;
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

export const updateProfileRequest = async (data: {
    firstName?: string;
    lastName?: string;
}) => {
    const response = await api.put("/api/auth/profile", data);
    return response.data;
};

export const uploadProfilePictureRequest = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    const response = await api.post("/api/auth/profile-picture", formData);
    return response.data;
};

export const getProfilePictureUrl = () => {
    const base =
        import.meta.env.VITE_API_URL ||
        import.meta.env.VITE_API_BASE_URL ||
        "http://localhost:8081";
    const normalizedBase =
        base === "/" ? "" : base.endsWith("/") ? base.slice(0, -1) : base;
    return `${normalizedBase}/api/auth/profile-picture`;
};
