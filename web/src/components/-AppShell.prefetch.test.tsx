import { fireEvent, render, screen, cleanup, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "./AppShell";
import { libraryOverviewQueryOptions } from "@/lib/navigationQueries";

const api = vi.hoisted(() => ({
  getAuthSnapshot: () => false,
  getDeals: vi.fn().mockResolvedValue({ results: [] }),
  getFriends: vi.fn().mockResolvedValue([]),
  getIncomingFriendRequests: vi.fn().mockResolvedValue([]),
  getLibraryOverview: vi.fn().mockResolvedValue({ games: [] }),
  getProfile: vi.fn(),
  getSteamSocial: vi.fn().mockResolvedValue({ friends: [] }),
  subscribeToAuthChanges: () => () => {},
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children, ...props }: React.ComponentProps<"a"> & { to: string }) => <a href={to} {...props}>{children}</a>,
  useRouterState: () => "/",
}));

vi.mock("@/components/ThemeSelector", () => ({ ThemeSelector: () => null }));
vi.mock("@/components/GameCover", () => ({ Avatar: () => null }));
vi.mock("@/lib/api", () => api);

function renderShell() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const prefetchQuery = vi.spyOn(queryClient, "prefetchQuery");
  render(<QueryClientProvider client={queryClient}><AppShell><p>Home</p></AppShell></QueryClientProvider>);
  return { queryClient, prefetchQuery };
}

describe("AppShell navigation prefetching", () => {
  afterEach(cleanup);

  it("prefetches Library data when its navigation link receives focus", async () => {
    const { prefetchQuery } = renderShell();

    fireEvent.focus(screen.getAllByRole("link", { name: "Library" })[0]);

    await waitFor(() => expect(prefetchQuery).toHaveBeenCalledWith(libraryOverviewQueryOptions()));
  });

  it("renders the actual deals cache age", async () => {
    api.getDeals.mockResolvedValue({
      results: Array.from({ length: 12 }, () => ({})),
      cached_at: new Date(Date.now() - 7 * 60_000).toISOString(),
    });

    renderShell();

    expect(await screen.findByText("12 price drops tracked · refreshed 7m ago")).toBeInTheDocument();
  });
});
