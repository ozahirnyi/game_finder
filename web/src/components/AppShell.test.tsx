import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "./AppShell";
import { ThemeProvider } from "@/lib/theme";

function renderAppShell(path: "/deals" | "/friends") {
  const rootRoute = createRootRoute({
    component: () => (
      <ThemeProvider>
        <AppShell>
          <Outlet />
        </AppShell>
      </ThemeProvider>
    ),
  });
  const pageRoute = createRoute({
    getParentRoute: () => rootRoute,
    path,
    component: () => <main>{path}</main>,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([pageRoute]),
    history: createMemoryHistory({ initialEntries: [path] }),
  });

  return render(<RouterProvider router={router} />);
}

describe("AppShell", () => {
  beforeEach(() => {
    vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
  });

  it("shows all product destinations and marks the current route", async () => {
    renderAppShell("/deals");

    const dealLinks = await screen.findAllByRole("link", { name: "Deals" });
    expect(dealLinks).toHaveLength(2);
    dealLinks.forEach((link) => {
      expect(link).toHaveAttribute("aria-current", "page");
    });
    expect(screen.getByRole("link", { name: "Friends" })).toHaveAttribute("href", "/friends");
    expect(screen.getByRole("link", { name: "PSN" })).toHaveAttribute("href", "/psn");
  });

  it("marks a different router location as current", async () => {
    renderAppShell("/friends");

    expect(await screen.findByRole("link", { name: "Friends" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    screen.getAllByRole("link", { name: "Home" }).forEach((link) => {
      expect(link).toHaveAttribute("href", "/");
    });
  });
});
