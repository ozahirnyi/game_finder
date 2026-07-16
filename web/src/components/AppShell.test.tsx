import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "./AppShell";

let pathname = "/";
const getAuthSnapshot = vi.fn<() => boolean>();

vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
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
  return render(ui);
}

describe("AppShell", () => {
  beforeEach(() => {
    pathname = "/";
    mockAuth(true);
  });

  it("shows all product destinations and marks the current route", () => {
    renderWithPath("/deals", <AppShell><main>Deals</main></AppShell>);

    expect(screen.getByRole("link", { name: "Deals" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Friends" })).toHaveAttribute("href", "/friends");
    expect(screen.getByRole("link", { name: "PSN" })).toHaveAttribute("href", "/psn");
  });

  it("shows sign in instead of protected destinations when unauthenticated", () => {
    mockAuth(false);
    renderWithPath("/", <AppShell><main>Home</main></AppShell>);

    expect(screen.getByRole("link", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Friends" })).not.toBeInTheDocument();
  });
});
