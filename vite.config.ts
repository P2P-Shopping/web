import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
    plugins: [react(), tailwindcss()],
    server: {
        port: 5173,
        strictPort: true,
        // Proxy /api requests to the Spring Boot backend
        // Avoids CORS issues between localhost:5173 (FE) and localhost:8081 (BE)
        proxy: {
            "/api": {
                target: "http://localhost:8081",
                changeOrigin: true,
            },
            "/ws": {
                target: "http://localhost:8081",
                ws: true,
                changeOrigin: true,
            },
        },
    },
    define: {
        // Prevents "global is not defined" crash from SockJS
        global: "window",
    },
});
