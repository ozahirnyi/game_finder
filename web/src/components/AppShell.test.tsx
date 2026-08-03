import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "./AppShell";
import { ThemeProvider } from "@/lib/theme";

let pathname = "/";
const getAuthSnapshot = vi.fn<() => boolean>();

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, ...props }: React.ComponentProps<"a"> & { to: string }) => <a href={to} {...props}>{children}</a>,
  useRouterState: () => pathname,
}));

vi.mock("@/lib/api", () => ({
  getAuthSnapshot: () => getAuthSnapshot(),
  subscribeToAuthChanges: () => () => undefined,
}));

function mockAuth(authenticated: boolean) {
  getAuthSnapshot.mockReturnValue(authenticated);
}

function renderWithPath(path: string, ui: React.ReactNode) {
  pathname = path;
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

describe("AppShell", () => {
  beforeEach(() => {
    pathname = "/";
    mockAuth(true);
  });

  it("shows all product destinations and marks the current route", () => {
    renderWithPath("/deals", <AppShell><main>Deals</main></AppShell>);

    expect(screen.getAllByRole("link", { name: "Deals" })[0]).toHaveAttribute("href", "/deals");
    expect(screen.getAllByRole("link", { name: "Friends" })[0]).toHaveAttribute("href", "/friends");
    expect(screen.getAllByRole("link", { name: "PSN" })[0]).toHaveAttribute("href", "/psn");
  });

  it("keeps navigation available when unauthenticated", () => {
    mockAuth(false);
    renderWithPath("/", <AppShell><main>Home</main></AppShell>);

    expect(screen.getAllByRole("link", { name: "Friends" })[0]).toHaveAttribute("href", "/friends");
  });
});
