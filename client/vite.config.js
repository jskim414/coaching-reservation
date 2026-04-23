import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, "..", "");
  const googleClientId = process.env.GOOGLE_CLIENT_ID || env.GOOGLE_CLIENT_ID || env.VITE_GOOGLE_CLIENT_ID || "";

  return {
    envDir: "..",
    envPrefix: ["VITE_"],
    define: {
      __GOOGLE_CLIENT_ID__: JSON.stringify(googleClientId),
    },
    plugins: [react()],
    build: {
      outDir: "../public",
      emptyOutDir: true,
    },
    server: {
      port: 5173,
      proxy: {
        "/api": "http://localhost:4000",
        "/health": "http://localhost:4000",
      },
    },
  };
});
