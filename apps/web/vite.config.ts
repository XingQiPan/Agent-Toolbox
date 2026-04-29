import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const apiTarget = process.env.AITBX_API_TARGET ?? "http://127.0.0.1:18788";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: false,
    proxy: {
      "/api": {
        target: apiTarget,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, "")
      }
    }
  }
});
