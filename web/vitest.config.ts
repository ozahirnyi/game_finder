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
      "@tanstack/react-router": path.join(
        rootDir,
        "src/test/tanstack-router.tsx",
      ),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    exclude: [
      ...configDefaults.exclude,
      "src/app/**",
      "src/features/auth/auth.test.tsx",
      "src/features/discovery/discovery.test.tsx",
      "src/features/discovery/lovable-discovery.test.tsx",
      "src/features/discovery/lovable-home-detail.test.tsx",
      "src/features/friends/friends.test.tsx",
      "src/features/integrations/integrations.test.tsx",
      "src/features/library/library.test.tsx",
      "src/components/lovable/**",
      "src/components/ui.test.tsx",
      "src/test/auth-recovery.routes.test.tsx",
      "src/test/steam-friends.integration.test.tsx",
    ],
  },
});
