import { ESLint } from "eslint";
import { readFileSync } from "node:fs";
import { configDefaults } from "vitest/config";
import { describe, expect, it } from "vitest";
import vitestConfig from "../../vitest.config";

const archivedNextSuites = [
  "src/app/destination-placeholders.test.tsx",
  "src/components/lovable/AppShell.test.tsx",
  "src/features/auth/auth.test.tsx",
  "src/features/discovery/discovery.test.tsx",
  "src/features/library/library.test.tsx",
];

describe("frontend verification configuration", () => {
  it("keeps archived Next-only suites out of the Vite test run", () => {
    const exclusions = vitestConfig.test?.exclude ?? [];

    expect(
      exclusions.filter((exclusion) => !configDefaults.exclude.includes(exclusion)),
    ).toEqual(archivedNextSuites);
  });

  it("keeps Prettier formatting outside the lint gate", async () => {
    const eslint = new ESLint({ cwd: process.cwd() });
    const [result] = await eslint.lintText('export const value="ok"\r\n', {
      filePath: "src/test/crlf-format.fixture.ts",
    });

    expect(
      result.messages.filter((message) => message.ruleId === "prettier/prettier"),
    ).toHaveLength(0);
  }, 30_000);

  it("accepts the active UI source without stale or empty-rule violations", async () => {
    const eslint = new ESLint({ cwd: process.cwd() });
    const results = await Promise.all(
      ["src/features/friends/FriendsScreen.tsx", "src/lib/theme.tsx"].map(
        async (filePath) =>
          eslint.lintText(readFileSync(filePath, "utf8"), { filePath }),
      ),
    );

    expect(
      results.flatMap(([result]) =>
        result.messages.filter((message) => message.severity === 2),
      ),
    ).toHaveLength(0);
  });
});
