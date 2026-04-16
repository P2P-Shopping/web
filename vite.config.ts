import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
    plugins: [react()],
    define: {
        // Prevents "global is not defined" crash from SockJS
        global: "window",
    },
});
