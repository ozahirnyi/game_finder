import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const realRootDir = fs.realpathSync(rootDir);

export default defineConfig({
  server: {
    fs: { allow: [realRootDir] },
  },
  resolve: {
    alias: {
      "@": path.join(rootDir, "src"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: [path.resolve(process.cwd(), "src/test/setup.ts")],
  },
});
