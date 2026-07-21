import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";

const nextRouterImport = /\b(?:from\s*|import\s*\()\s*["']next\/(?:link|navigation)["']/;

function runtimeSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) return runtimeSourceFiles(file);
    return entry.isFile() && /\.(?:ts|tsx)$/.test(entry.name) && !/\.test\.(?:ts|tsx)$/.test(entry.name) ? [file] : [];
  });
}

function prohibitedImports(sourceRoot: string) {
  return runtimeSourceFiles(sourceRoot).filter((file) => nextRouterImport.test(readFileSync(file, "utf8")));
}

describe("Next router import boundary", () => {
  it("does not allow runtime source imports from next/link or next/navigation", () => {
    expect(prohibitedImports(path.join(process.cwd(), "src"))).toEqual([]);
  });

  it("detects a prohibited router import", () => {
    const sourceRoot = mkdtempSync(path.join(tmpdir(), "no-next-imports-"));
    const prohibitedFile = path.join(sourceRoot, "blocked.ts");
    writeFileSync(prohibitedFile, 'import Link from "next/link";');

    try {
      expect(prohibitedImports(sourceRoot)).toEqual([prohibitedFile]);
    } finally {
      rmSync(sourceRoot, { recursive: true, force: true });
    }
  });
});
