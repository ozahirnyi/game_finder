import { render, screen } from "@testing-library/react";
import type { ComponentPropsWithoutRef } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "./AppShell";

const mocks = vi.hoisted(() => ({ signOut: vi.fn() }));
let pathname = "/";
let authenticated = true;
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    ...props
  }: ComponentPropsWithoutRef<"a"> & { to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useRouterState: () => pathname,
  useNavigate: () => vi.fn(),
}));
vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: { email: "player@example.test" } }),
  useQueryClient: () => ({}),
}));
vi.mock("@/lib/auth-session", () => ({
  useAuthenticated: () => authenticated,
  currentUserQueryOptions: () => ({}),
  signOut: mocks.signOut,
}));
vi.mock("./ThemeSelector", () => ({ ThemeSelector: () => <div /> }));

describe("AppShell", () => {
  beforeEach(() => {
    pathname = "/";
    authenticated = true;
    mocks.signOut.mockReset();
  });
  it("shows all product destinations and marks the current route", () => {
    pathname = "/deals";
    render(
      <AppShell>
        <main>Deals</main>
      </AppShell>,
    );
    expect(screen.getAllByRole("link", { name: "Deals" })[0]).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getAllByRole("link", { name: "Friends" })[0]).toHaveAttribute(
      "href",
      "/friends",
    );
  });
  it("shows sign in instead of protected destinations when unauthenticated", () => {
    authenticated = false;
    render(
      <AppShell>
        <main>Home</main>
      </AppShell>,
    );
    expect(
      screen.getAllByRole("link", { name: "Sign in" })[0],
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Friends" }),
    ).not.toBeInTheDocument();
  });
});
