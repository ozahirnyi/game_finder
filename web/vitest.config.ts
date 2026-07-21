import path from "node:path";
import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": path.join(rootDir, "src"),
      "next/link": path.join(rootDir, "src/test/next-link.tsx"),
      "next/navigation": path.join(rootDir, "src/test/next-navigation.ts"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    exclude: [
      ...configDefaults.exclude,
      "src/app/**",
      "src/features/**",
      "src/components/lovable/**",
      "src/components/ui.test.tsx",
      "src/test/auth-recovery.routes.test.tsx",
      "src/test/library-wishlist.routes.test.tsx",
      "src/test/steam-friends.integration.test.tsx",
    ],
  },
});
