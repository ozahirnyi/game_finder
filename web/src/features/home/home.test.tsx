import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAuthState } from "@/hooks/useAuthState";
import { getHomepageDeals, getSteamAccount } from "@/lib/api";
import { Dashboard } from "@/routes/index";
import { GuestHome } from "./GuestHome";
import { HomeScreen } from "./HomeScreen";

const mockNavigate = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => () => ({}),
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
  useNavigate: () => mockNavigate,
}));
vi.mock("@/components/AppShell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => (
    <main>{children}</main>
  ),
}));
vi.mock("@/hooks/useAuthState", () => ({ useAuthState: vi.fn() }));
vi.mock("@/lib/api", () => ({
  getHomepageDeals: vi.fn(),
  getDashboard: vi.fn(),
  getSteamAccount: vi.fn(),
  getSteamLoginUrl: vi.fn(),
  searchGames: vi.fn(),
}));

describe("homepage branches", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getHomepageDeals).mockResolvedValue({ results: [] });
  });

  it("shows public search and public deals without calling Steam when signed out", () => {
    vi.mocked(useAuthState).mockReturnValue(false);
    render(<HomeScreen />);
    expect(
      screen.getByRole("heading", { name: /find your next game/i }),
    ).toBeVisible();
    expect(getSteamAccount).not.toHaveBeenCalled();
  });

  it("uses the public homepage from the root route when signed out", () => {
    vi.mocked(useAuthState).mockReturnValue(false);

    render(
      <QueryClientProvider client={new QueryClient()}>
        <Dashboard />
      </QueryClientProvider>,
    );

    expect(
      screen.getByRole("heading", { name: /find your next game/i }),
    ).toBeVisible();
    expect(getSteamAccount).not.toHaveBeenCalled();
  });

  it("shows connect Steam after a signed-in account is confirmed unlinked", async () => {
    vi.mocked(useAuthState).mockReturnValue(true);
    vi.mocked(getSteamAccount).mockResolvedValue({
      linked: false,
      steam_id: null,
      persona_name: null,
      avatar: null,
      country_code: null,
      linked_at: null,
    });
    render(<HomeScreen />);
    expect(
      await screen.findByRole("heading", {
        name: "Connect Steam to personalize GameFinder",
      }),
    ).toBeVisible();
  });

  it("sends the guest hero search to the existing search route", async () => {
    render(<GuestHome />);
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "hades" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Search games" }));
    expect(mockNavigate).toHaveBeenCalledWith({
      to: "/search",
      search: { q: "hades" },
    });
  });

  it("marks homepage regions for shared entry and card motion", () => {
    render(<GuestHome />);
    expect(screen.getByTestId("guest-home")).toHaveClass("page-enter");
    expect(screen.getByTestId("guest-home")).toHaveClass("max-w-6xl");
    expect(screen.getByRole("searchbox")).toHaveClass("bg-surface");
    expect(screen.getByTestId("public-deals")).toHaveClass("stagger-enter");
  });
});
