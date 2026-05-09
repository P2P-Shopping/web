import axios from "axios";
import { useStore } from "../context/useStore";

const API_URL = import.meta.env.VITE_API_BASE_URL;

const api = axios.create({
    baseURL: API_URL,
    withCredentials: true,
    timeout: 10_000,
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

    return api.post("/api/shopping/finish", formData, { timeout: 60_000 });
};

/**
 * Task 4: API Request for Multimodal AI Input
 */
export const aiMultimodalRequest = async (
    text: string,
    image: File | null,
    lat?: number | null,
    lng?: number | null,
) => {
    const formData = new FormData();
    formData.append("text", text);
    if (image) {
        formData.append("image", image);
    }
    if (lat !== undefined && lat !== null) {
        formData.append("latitude", lat.toString());
    }
    if (lng !== undefined && lng !== null) {
        formData.append("longitude", lng.toString());
    }

    return api.post("/api/ai/generate", formData, { timeout: 60_000 });
};

export interface ProductSuggestion {
    name: string;
    brand: string | null;
    category: string | null;
    price: number | null;
    quantity: string;
}

export const fetchProductSuggestions = async (
    query: string,
): Promise<ProductSuggestion[]> => {
    if (!query || query.trim().length === 0) {
        return [];
    }

    try {
        const response = await api.get<ProductSuggestion[]>(
            `/api/catalog/suggest?q=${encodeURIComponent(query)}`,
        );
        return response.data;
    } catch (error) {
        console.error(
            "Error while fetching the suggestions from backend: ",
            error,
        );
        return [];
    }
};

/**
 * Task 21: Endpoint for fetching a single list by its ID to perform a hard refresh.
 */
export const fetchListByIdRequest = async (listId: string) => {
    const response = await api.get(`/api/lists/${listId}`, { timeout: 10_000 });
    return response.data;
};

export default api;
