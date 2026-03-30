import axios from 'axios';

const API_URL = import.meta.env.VITE_API_BASE_URL;

const MOCK_USER = { id: "1", email: "your@email.com", name: "Adrian Hordila" };

export const loginRequest = async (email: string, password: string) => {
    try {
        const response = await axios.post(`${API_URL}/api/auth/login`, 
            { email, password }, 
            { withCredentials: true }
        );
        return response.data;
    } catch (error) {
        console.warn("Backend-ul nu raspunde. Folosim date fictive.");
        if (email === "your@email.com" && password === "12345678") {
            return MOCK_USER;
        }
        throw new Error("Date de logare incorecte (Verificare Mock)");
    }
};

export const registerRequest = async (formData: any) => {
    try {
        const response = await axios.post(`${API_URL}/api/auth/register`, formData, { withCredentials: true });
        return response.data;
    } catch (error) {
        return { success: true, message: "Mock Register Success" };
    }
};