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

// Global response interceptor for 401s
api.interceptors.response.use(
    (response) => response,
    (error) => {
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
