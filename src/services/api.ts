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

api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (axios.isAxiosError(error) && error.response?.status === 401) {
            if (!globalThis.location.pathname.includes("/login")) {
                useStore.getState().setAuth(null, null);
            }
        }
        return Promise.reject(error);
    },
);

// Task 4: Finish Shopping Flow
export const finishShoppingRequest = async (data: { storeName: string; receiptImage: File | null; listId: string }) => {
    const formData = new FormData();
    formData.append("storeName", data.storeName);
    formData.append("listId", data.listId);
    if (data.receiptImage) {
        formData.append("receipt", data.receiptImage);
    }
    return api.post("/api/shopping/finish", formData, {
        headers: { "Content-Type": "multipart/form-data" }
    });
};

export default api;