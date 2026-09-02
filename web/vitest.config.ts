import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

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
    // These suites cover the archived Next.js application, not the active Vite app.
    exclude: [
      ...configDefaults.exclude,
      "src/app/destination-placeholders.test.tsx",
      "src/components/lovable/AppShell.test.tsx",
      "src/features/auth/auth.test.tsx",
      "src/features/discovery/discovery.test.tsx",
      "src/features/library/library.test.tsx",
    ],
  },
});
