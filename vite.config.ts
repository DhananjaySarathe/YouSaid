import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    rollupOptions: {
      input: {
        popup: "src/popup/index.html",
        background: "src/background.ts",
        content: "src/content.ts",
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "[name].js",
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.includes("index.html")) {
            return "popup.html";
          }
          return "[name].[ext]";
        },
      },
    },
  },
  publicDir: "public",
});
