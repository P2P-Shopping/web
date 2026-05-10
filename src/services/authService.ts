import { useStore } from "../context/useStore";
import api from "./api";

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

      const response = await api.post(
        "/api/auth/login",
        { email, password },
        {
          headers: {
            "X-Return-Token": "true",
          },
        },
      );
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
        return response.data;
      } catch {
        // Silently fail auth check as it's expected when not logged in
        return null;

      }
      throw new Error("Date incorecte (Modul Mock)");
    }
  };

  export const registerRequest = async (data: Record<string, unknown>) => {
    return (
      await axios.post(`${API_URL}/api/auth/register`, data, {
        withCredentials: true,
      })
    ).data;


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
