// @vitest-environment jsdom
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OnboardingGuidance } from "./OnboardingGuidance";

function renderGuidance(component: React.ReactNode) {
  const root = createRootRoute({ component: Outlet });
  const home = createRoute({ getParentRoute: () => root, path: "/", component: () => component });
  const account = createRoute({ getParentRoute: () => root, path: "/account", component: () => null });
  const psnImport = createRoute({ getParentRoute: () => root, path: "/psn-import", component: () => null });
  const search = createRoute({ getParentRoute: () => root, path: "/search", component: () => null });
  const friends = createRoute({ getParentRoute: () => root, path: "/friends", component: () => null });
  const wishlist = createRoute({ getParentRoute: () => root, path: "/wishlist", component: () => null });
  const router = createRouter({
    routeTree: root.addChildren([home, account, psnImport, search, friends, wishlist]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  render(<RouterProvider router={router} />);
}

afterEach(cleanup);

describe("OnboardingGuidance", () => {
  it("shows a new user every unresolved setup step in product order", async () => {
    renderGuidance(
      <OnboardingGuidance
        summary={{
          steam_linked: false,
          psn_library_games: 0,
          wishlist_games: 0,
          price_alerts: 0,
          friends: 0,
        }}
        isPending={false}
        isError={false}
        onRetry={vi.fn()}
      />,
    );

    const steps = await screen.findAllByRole("heading", { level: 3 });
    expect(steps.map((step) => step.textContent)).toEqual([
      "Connect a library",
      "Add a wishlist game",
      "Find friends",
    ]);
    expect(screen.getByRole("link", { name: "Connect Steam" })).toHaveAttribute("href", "/account");
    expect(screen.getByRole("link", { name: "Import PlayStation" })).toHaveAttribute("href", "/psn-import");
    expect(screen.getByRole("link", { name: "Add a wishlist game" })).toHaveAttribute("href", "/search");
    expect(screen.getByRole("link", { name: "Find friends" })).toHaveAttribute("href", "/friends");
  });

  it("treats linked Steam or imported PSN games as a completed library", async () => {
    renderGuidance(
      <OnboardingGuidance
        summary={{ steam_linked: true, psn_library_games: 0, wishlist_games: 0, price_alerts: 0, friends: 0 }}
        isPending={false}
        isError={false}
        onRetry={vi.fn()}
      />,
    );
    expect(screen.queryByText("Connect a library")).not.toBeInTheDocument();

    cleanup();
    renderGuidance(
      <OnboardingGuidance
        summary={{ steam_linked: false, psn_library_games: 1, wishlist_games: 0, price_alerts: 0, friends: 0 }}
        isPending={false}
        isError={false}
        onRetry={vi.fn()}
      />,
    );
    expect(screen.queryByText("Connect a library")).not.toBeInTheDocument();
  });

  it("offers an alert only after a wishlist game exists and keeps no-friends guidance", async () => {
    renderGuidance(
      <OnboardingGuidance
        summary={{ steam_linked: true, psn_library_games: 0, wishlist_games: 1, price_alerts: 0, friends: 0 }}
        isPending={false}
        isError={false}
        onRetry={vi.fn()}
      />,
    );

    expect(await screen.findByRole("heading", { name: "Create your first price alert" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Create your first price alert" })).toHaveAttribute("href", "/wishlist");
    expect(screen.getByRole("heading", { name: "Find friends" })).toBeInTheDocument();
  });

  it("renders compact loading, retryable error, and nothing after full completion", () => {
    const retry = vi.fn();
    const { rerender } = render(
      <OnboardingGuidance isPending isError={false} compact onRetry={retry} />,
    );
    expect(screen.getByText("Preparing your setup…")).toBeInTheDocument();
    expect(screen.getByTestId("onboarding-guidance-compact")).toBeInTheDocument();

    rerender(<OnboardingGuidance isPending={false} isError compact onRetry={retry} />);
    expect(screen.getByText("Setup guidance is unavailable")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry setup guidance" }));
    expect(retry).toHaveBeenCalledOnce();

    rerender(
      <OnboardingGuidance
        summary={{ steam_linked: true, psn_library_games: 0, wishlist_games: 1, price_alerts: 1, friends: 1 }}
        isPending={false}
        isError={false}
        onRetry={retry}
      />,
    );
    expect(screen.queryByText("Setup guidance is unavailable")).not.toBeInTheDocument();
    expect(screen.queryByText("Connect a library")).not.toBeInTheDocument();
  });
});
