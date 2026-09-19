import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  server: {
    fs: {
      allow: [path.resolve(import.meta.dirname)],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
  },
});
