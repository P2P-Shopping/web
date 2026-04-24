import axios from "axios";

const API_URL = import.meta.env.VITE_API_BASE_URL;

export const loginRequest = async (email: string, password: string) => {
    const response = await axios.post(
        `${API_URL}/api/auth/login`,
        { email, password },
        { withCredentials: true },
    );

    // Tokens are now set by HttpOnly cookies from the backend.
    // We don't store them in localStorage anymore.
    return response.data;
};

export const registerRequest = async (data: Record<string, unknown>) => {
    const response = await axios.post(`${API_URL}/api/auth/register`, data, {
        withCredentials: true,
    });
    return response.data;
};

export const checkAuthRequest = async () => {
    try {
        const response = await axios.get(`${API_URL}/api/auth/me`, {
            withCredentials: true,
        });
        return response.data;
    } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 401) {
            return null;
        }
        console.error("Check auth failed:", error);
        return null;
    }
};

export const logoutRequest = async () => {
    try {
        await axios.post(
            `${API_URL}/api/auth/logout`,
            {},
            {
                withCredentials: true,
            },
        );
    } catch (error) {
        console.error("Logout request failed:", error);
    }
};
