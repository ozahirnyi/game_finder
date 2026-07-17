import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "./AppShell";

let pathname = "/";
let authenticated = false;
let notifyAuthChange: (() => void) | undefined;

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    ...props
  }: React.ComponentProps<"a"> & { to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useRouterState: ({
    select,
  }: {
    select: (state: { location: { pathname: string } }) => string;
  }) => select({ location: { pathname } }),
}));

vi.mock("@/lib/api", () => ({
  isAuthenticated: () => authenticated,
  subscribeToAuthChanges: (callback: () => void) => {
    notifyAuthChange = callback;
    return () => {
      notifyAuthChange = undefined;
    };
  },
}));

vi.mock("./ThemeSelector", () => ({
  ThemeSelector: () => <div />,
}));

describe("AppShell", () => {
  beforeEach(() => {
    pathname = "/";
    authenticated = false;
    notifyAuthChange = undefined;
  });

  it("shows login and registration links without a fake identity when signed out", () => {
    render(
      <AppShell>
        <main>Home</main>
      </AppShell>,
    );

    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/login",
    );
    expect(
      screen.getByRole("link", { name: "Create account" }),
    ).toHaveAttribute("href", "/register");
    expect(screen.queryByText("Steam · Synced")).not.toBeInTheDocument();
    expect(screen.queryByText("updated 4m ago")).not.toBeInTheDocument();
  });

  it("updates the sidebar after an auth change", () => {
    const { rerender } = render(
      <AppShell>
        <main>Home</main>
      </AppShell>,
    );

    authenticated = true;
    act(() => notifyAuthChange?.());
    rerender(
      <AppShell>
        <main>Home</main>
      </AppShell>,
    );

    expect(screen.getByRole("link", { name: "Signed in" })).toHaveAttribute(
      "href",
      "/profile",
    );
    expect(
      screen.queryByRole("link", { name: "Sign in" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Create account" }),
    ).not.toBeInTheDocument();
  });
});
