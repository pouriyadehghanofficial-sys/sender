import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// این SPA زیر مسیر /app سرو می‌شود (پنل قدیمی تک‌مستأجر همچنان زیر /ui دست‌نخورده مانده)
export default defineConfig({
  base: "/app/",
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": { target: "http://localhost:3000", changeOrigin: true },
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
