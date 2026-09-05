import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "./AppShell";
import { ThemeProvider } from "@/lib/theme";

let pathname = "/";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, ...props }: { children: React.ReactNode; to: string }) => <a {...props} href={to}>{children}</a>,
  useRouterState: ({ select }: { select: (state: { location: { pathname: string } }) => string }) => select({ location: { pathname } }),
}));

function renderWithPath(path: string, ui: React.ReactNode) {
  pathname = path;
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

describe("AppShell", () => {
  beforeEach(() => {
    pathname = "/";
  });

  it("shows all product destinations and marks the current route", () => {
    renderWithPath("/deals", <AppShell><main>Deals</main></AppShell>);

    expect(screen.getAllByRole("link", { name: "Deals" }).some((link) => link.className.includes("bg-white/5"))).toBe(true);
    expect(screen.getByRole("link", { name: "Friends" })).toHaveAttribute("href", "/friends");
    expect(screen.getByRole("link", { name: "PSN" })).toHaveAttribute("href", "/psn");
  });

  it("keeps product navigation available from the root app shell", () => {
    renderWithPath("/", <AppShell><main>Home</main></AppShell>);

    expect(screen.getByRole("link", { name: "Friends" })).toHaveAttribute("href", "/friends");
  });
});
