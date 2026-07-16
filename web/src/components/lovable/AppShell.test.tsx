import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ThemeProvider } from "@/lib/theme";
import { AppShell } from "./AppShell";

describe("Lovable AppShell", () => {
  it("keeps the archive navigation labels", () => {
    render(<ThemeProvider><AppShell><p>Content</p></AppShell></ThemeProvider>);

    expect(screen.getAllByText("GameFinder").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Wishlist").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Friends").length).toBeGreaterThan(0);
  });
});
