import axios from "axios";
import { useStore } from "../context/useStore";

const API_URL = import.meta.env.VITE_API_BASE_URL;

const api = axios.create({
    baseURL: API_URL,
    withCredentials: true,
});

api.interceptors.request.use((config) => {
    const token = useStore.getState().token;
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Global response interceptor for error handling
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (axios.isAxiosError(error) && error.response?.data) {
            const data = error.response.data;
            // Use the server-provided message if available
            const serverMessage = data.message || data.error || data.details;
            if (serverMessage && typeof serverMessage === "string") {
                error.message = serverMessage;
            }
        }

        if (axios.isAxiosError(error) && error.response?.status === 401) {
            // Only clear auth if we weren't already on the login page
            if (!globalThis.location.pathname.includes("/login")) {
                useStore.getState().setAuth(null, null);
            }
        }
        return Promise.reject(error);
    },
);

export default api;
