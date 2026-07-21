import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "@/lib/theme";
import { AppShell } from "./AppShell";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
  useRouterState: ({ select }: { select: (state: { location: { pathname: string } }) => unknown }) => select({ location: { pathname: "/" } }),
}));

describe("Lovable AppShell", () => {
  it("keeps the archive navigation labels", () => {
    render(<ThemeProvider><AppShell><p>Content</p></AppShell></ThemeProvider>);

    expect(screen.getAllByText("GameFinder").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Wishlist").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Friends").length).toBeGreaterThan(0);
  });
});
