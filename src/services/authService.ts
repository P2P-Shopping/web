import axios from "axios";

const API_URL = import.meta.env.VITE_API_BASE_URL;
const MOCK_USER = { id: "1", email: "your@email.com", name: "Adrian Hordila" };

export const loginRequest = async (email: string, password: string) => {
  try {
    const response = await axios.post(
      `${API_URL}/api/auth/login`,
      { email, password },
      { withCredentials: true }
    );
    return response.data;
  } catch (error) {
    console.error("Eroare autentificare (Backend Offline):", error);
    if (email === "your@email.com" && password === "12345678") {
      return MOCK_USER;
    }
    throw new Error("Date incorecte (Modul Mock)");
  }
};

export const registerRequest = async (data: any) => {
  try {
    return (await axios.post(`${API_URL}/api/auth/register`, data, { withCredentials: true })).data;
  } catch (e) {
    return { message: "Mock success" };
  }
};
