import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  define: {
    // Prevents "global is not defined" crash from SockJS
    global: "window",
  },
});
