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
            const serverMessage = data.message || data.error || data.details;
            if (serverMessage && typeof serverMessage === "string") {
                error.message = serverMessage;
            }
        }

        if (axios.isAxiosError(error) && error.response?.status === 401) {
            if (!globalThis.location.pathname.includes("/login")) {
                useStore.getState().setAuth(null, null);
            }
        }
        return Promise.reject(error);
    },
);

/**
 * Task 4: API Request for Finishing Shopping
 * REPARAT: Fără header-ul Content-Type manual pentru a lăsa Axios să pună 'boundary' corect.
 */
export const finishShoppingRequest = async (data: {
    storeName: string;
    receiptImage: File | null;
    listId: string;
}) => {
    const formData = new FormData();
    formData.append("storeName", data.storeName);
    formData.append("listId", data.listId);
    if (data.receiptImage) {
        formData.append("receipt", data.receiptImage);
    }

    return api.post("/api/shopping/finish", formData);
};

/**
 * Task 4: API Request for Multimodal AI Input
 */
export const aiMultimodalRequest = async (
    prompt: string,
    image: File | null,
) => {
    const formData = new FormData();
    formData.append("prompt", prompt);
    if (image) {
        formData.append("image", image);
    }

    return api.post("/api/ai/analyze", formData);
};

export default api;
