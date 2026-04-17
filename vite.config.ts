import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import basicSsl from '@vitejs/plugin-basic-ssl'

export default defineConfig({
    server: {
        https: true as any// Enables HTTPS
    },
    plugins: [react(), basicSsl()],
    define: {
        // Prevents "global is not defined" crash from SockJS
        global: "window",
    },
});
