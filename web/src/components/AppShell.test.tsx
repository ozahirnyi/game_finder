import { render, screen } from "@testing-library/react";
import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "./AppShell";
import { ThemeProvider } from "@/lib/theme";

const auth = vi.hoisted(() => ({
  useAuthState: vi.fn(),
}));

vi.mock("@/hooks/useAuthState", () => auth);

function renderAt(pathname: string) {
  const rootRoute = createRootRoute({
    component: () => (
      <AppShell>
        <Outlet />
      </AppShell>
    ),
  });
  const indexRoute = createRoute({
    component: () => <p>Home</p>,
    getParentRoute: () => rootRoute,
    path: "/",
  });
  const dealsRoute = createRoute({
    component: () => <p>Deals page</p>,
    getParentRoute: () => rootRoute,
    path: "/deals",
  });
  const router = createRouter({
    history: createMemoryHistory({ initialEntries: [pathname] }),
    routeTree: rootRoute.addChildren([indexRoute, dealsRoute]),
  });

  return render(
    <ThemeProvider>
      <RouterProvider router={router} />
    </ThemeProvider>,
  );
}

describe("AppShell", () => {
  beforeEach(() => {
    auth.useAuthState.mockReturnValue(true);
  });

  it("shows all product destinations and marks the current route", async () => {
    renderAt("/deals");

    expect(
      (await screen.findAllByRole("link", { name: "Deals" })).some(
        (link) => link.getAttribute("aria-current") === "page",
      ),
    ).toBe(true);
    expect(screen.getByRole("link", { name: "Friends" })).toHaveAttribute(
      "href",
      "/friends",
    );
    expect(screen.getByRole("link", { name: "PSN" })).toHaveAttribute(
      "href",
      "/psn",
    );
  });

  it("shows sign in instead of protected destinations when unauthenticated", async () => {
    auth.useAuthState.mockReturnValue(false);
    renderAt("/");

    expect(await screen.findByRole("link", { name: "Sign in" })).toBeVisible();
    expect(
      screen.queryByRole("link", { name: "Friends" }),
    ).not.toBeInTheDocument();
  });
});
