import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Dashboard } from "@/routes/index";
import { LibraryPage, Route as LibraryRoute } from "@/routes/library";
import { ProfilePage } from "@/routes/profile";
import { Route as PsnRoute } from "@/routes/psn";
import { Route as SteamRoute } from "@/routes/steam";
import { SteamLibraryPanel } from "@/features/library/SteamLibraryPanel";

const api = vi.hoisted(() => ({
  clearToken: vi.fn(),
  getDashboard: vi.fn(),
  getGoogleLinkUrl: vi.fn(),
  getHomepageDeals: vi.fn(),
  getLibraryOverview: vi.fn(),
  resolveSteamLibraryGame: vi.fn(),
  getProfileSummary: vi.fn(),
  getSteamLinkUrl: vi.fn(),
  getAuthSnapshot: vi.fn(),
  isAuthenticated: vi.fn(),
  subscribeToAuthChanges: vi.fn(() => () => undefined),
  syncSteamLibrary: vi.fn(),
  updateProfile: vi.fn(),
}));
const navigate = vi.fn();
const redirect = vi.hoisted(() => vi.fn((options) => options));
const librarySearch = vi.hoisted(() => vi.fn());

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: object) => ({
    ...options,
    useSearch: librarySearch,
  }),
  Link: ({ children, ...props }: React.ComponentProps<"a">) => (
    <a {...props}>{children}</a>
  ),
  redirect,
  useNavigate: () => navigate,
}));
vi.mock("@/components/AppShell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => (
    <main>{children}</main>
  ),
}));
vi.mock("@/lib/api", () => api);

const ready = (data: unknown) => ({ status: "ready", data, message: null });
const empty = (message: string) => ({ status: "empty", data: null, message });
const disconnected = (message: string) => ({
  status: "not_connected",
  data: null,
  message,
});
const game = {
  id: "saved-1",
  title: "Hades II",
  notes: null,
  info: null,
  source: "steam",
  external_id: "1145350",
  playtime_forever: 125,
  playtime_2weeks: null,
  img_icon_url: null,
  synced_at: null,
  created_at: "2026-07-16T00:00:00Z",
};
const steam = {
  linked: true,
  steam_id: "1",
  persona_name: "Niko",
  avatar: null,
  country_code: null,
  linked_at: null,
};

describe("legacy platform redirects", () => {
  beforeEach(() => redirect.mockClear());

  it("preserves Steam callback state in the Library Steam tab", () => {
    expect(() =>
      SteamRoute.beforeLoad?.({ search: { linked: "1", error: "example" } }),
    ).toThrow();
    expect(redirect).toHaveBeenCalledWith({
      to: "/library",
      search: { tab: "steam", linked: "1", error: "example" },
      replace: true,
    });
  });

  it("redirects PSN to the Library PSN tab", () => {
    expect(() => PsnRoute.beforeLoad?.({ search: {} })).toThrow();
    expect(redirect).toHaveBeenCalledWith({
      to: "/library",
      search: { tab: "psn" },
      replace: true,
    });
  });
});

function summary() {
  return {
    account: ready({
      user: {
        id: "user-1",
        email: "player@example.com",
        created_at: "2026-01-01",
        google_linked: false,
      },
    }),
    profile: ready({
      bio: "Arcade fan",
      platforms: ["PC"],
      favorite_genres: ["Roguelike"],
    }),
    services: ready({
      steam,
      telegram: {
        linked: false,
        configured: true,
        username: null,
        linked_at: null,
      },
      google: { linked: true },
      psn_games: 0,
    }),
    library: ready({
      games: [game],
      total_games: 1,
      total_playtime_hours: 2,
      manual_games: 0,
      psn_games: 0,
    }),
    favorites: ready([game]),
    wishlist: empty("No wishlist games yet."),
    recently_played: ready([
      {
        appid: 1145350,
        name: "Hades II",
        playtime_forever: 125,
        playtime_2weeks: 0,
        img_icon_url: null,
      },
    ]),
  };
}

function dashboard() {
  return {
    user: ready({
      id: "user-1",
      email: "player@example.com",
      created_at: "2026-01-01",
      google_linked: false,
    }),
    library: ready({
      games: [game],
      total_games: 1,
      total_playtime_hours: 2,
      manual_games: 0,
      psn_games: 0,
    }),
    recommendations: ready({
      recommendations: [
        {
          title: "Balatro",
          reason: "Because you enjoy roguelikes",
          tags: ["Cards"],
          cover_url: "https://cdn.example/balatro.jpg",
        },
      ],
    }),
    deals: empty("No price drops yet."),
    steam: ready({ steam }),
    social: disconnected("Connect Steam to see friends."),
  };
}

function renderPage(view: React.ReactElement) {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      {view}
    </QueryClientProvider>,
  );
}

describe("live dashboard and profile data", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getDashboard.mockResolvedValue(dashboard());
    api.getProfileSummary.mockResolvedValue(summary());
    api.getLibraryOverview.mockResolvedValue({
      games: [
        {
          id: "saved-1",
          source: "manual",
          external_id: null,
          detail_game_id: "saved-1",
          title: "Hades II",
          cover_url: null,
          playtime_forever: 125,
        },
      ],
      steam_available: false,
      steam_error: null,
    });
    api.isAuthenticated.mockReturnValue(true);
    api.getAuthSnapshot.mockImplementation(() => api.isAuthenticated());
    librarySearch.mockReturnValue({ tab: "library" });
  });

  it("shows guest actions immediately without requesting a profile", () => {
    api.isAuthenticated.mockReturnValue(false);
    renderPage(<ProfilePage />);

    expect(screen.getByText("Create account")).toBeVisible();
    expect(api.getProfileSummary).not.toHaveBeenCalled();
  });

  it("renders dashboard blocks from the summary response and useful disconnected states", async () => {
    renderPage(<Dashboard />);
    expect((await screen.findAllByText("Balatro")).length).toBeGreaterThan(0);
    expect(await screen.findByRole("img", { name: "Balatro" })).toHaveAttribute(
      "src",
      "https://cdn.example/balatro.jpg",
    );
    expect(screen.getByText("No price drops yet.")).toBeVisible();
    expect(screen.getByText("Steam connected")).toBeVisible();
    expect(screen.queryByText("Data unavailable")).not.toBeInTheDocument();
  });

  it("shows a recommendation-provider error instead of the empty CTA", async () => {
    api.getDashboard.mockResolvedValue({
      ...dashboard(),
      recommendations: {
        status: "error",
        data: [],
        message:
          "Recommendations are temporarily unavailable. Please try again later.",
      },
    });
    renderPage(<Dashboard />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Recommendations are temporarily unavailable. Please try again later.",
    );
  });

  it("shows Steam onboarding instead of a personal dashboard when unlinked", async () => {
    api.getDashboard.mockResolvedValue({
      ...dashboard(),
      steam: disconnected("Connect Steam to sync your library."),
    });

    renderPage(<Dashboard />);

    expect(
      await screen.findByRole("heading", {
        name: "Connect Steam to personalize GameFinder",
      }),
    ).toBeVisible();
    expect(screen.queryByText("Balatro")).not.toBeInTheDocument();
  });

  it("renders profile and library values from the profile summary without demo cards", async () => {
    renderPage(<ProfilePage />);
    expect(
      await screen.findByRole("heading", { name: "player@example.com" }),
    ).toBeVisible();
    expect(screen.getByText("Arcade fan")).toBeVisible();
    expect(screen.getAllByText("Hades II").length).toBeGreaterThan(0);
    expect(screen.getByText("No wishlist games yet.")).toBeVisible();
    expect(screen.getByText("Google").parentElement).toHaveTextContent(
      "Connected",
    );
    expect(screen.queryByText("Data unavailable")).not.toBeInTheDocument();
  });

  it("saves editable profile fields and refreshes the summary", async () => {
    api.updateProfile.mockResolvedValue({
      bio: "Updated bio",
      platforms: ["PC"],
      favorite_genres: ["Puzzle"],
    });
    renderPage(<ProfilePage />);
    await screen.findByRole("heading", { name: "player@example.com" });
    fireEvent.click(screen.getByRole("button", { name: /edit profile/i }));
    fireEvent.change(screen.getByLabelText("Bio"), {
      target: { value: "Updated bio" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Puzzle" }));
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));
    await waitFor(() =>
      expect(api.updateProfile.mock.calls[0]?.[0]).toEqual({
        bio: "Updated bio",
        platforms: ["PC"],
        favorite_genres: ["Roguelike", "Puzzle"],
      }),
    );
  });

  it("renders saved collection covers from the profile summary", async () => {
    api.getProfileSummary.mockResolvedValue({
      ...summary(),
      favorites: ready([
        { ...game, cover_url: "https://cdn.example/favorite.jpg" },
      ]),
      wishlist: ready([
        {
          ...game,
          id: "wish-1",
          title: "Wishlist game",
          cover_url: "https://cdn.example/wishlist.jpg",
        },
      ]),
    });
    renderPage(<ProfilePage />);
    expect(
      await screen.findByRole("img", { name: "Hades II" }),
    ).toHaveAttribute("src", "https://cdn.example/favorite.jpg");
    expect(screen.getByRole("img", { name: "Wishlist game" })).toHaveAttribute(
      "src",
      "https://cdn.example/wishlist.jpg",
    );
  });

  it("renders manual library games with an intentional cover fallback", async () => {
    api.getProfileSummary.mockResolvedValue({
      ...summary(),
      library: ready({
        ...summary().library.data,
        games: [
          {
            ...game,
            id: "manual-1",
            title: "Manual game",
            source: "manual",
            img_icon_url: null,
          },
        ],
      }),
    });
    renderPage(<ProfilePage />);
    expect(await screen.findByText("Manual game")).toBeVisible();
  });

  it("updates only the selected library visibility", async () => {
    api.updateProfile.mockResolvedValue({
      bio: "Arcade fan",
      platforms: ["PC"],
      favorite_genres: ["Roguelike"],
    });
    renderPage(<ProfilePage />);
    await screen.findByRole("heading", { name: "player@example.com" });
    fireEvent.click(screen.getByRole("button", { name: /edit profile/i }));
    fireEvent.change(screen.getByLabelText("Library visibility"), {
      target: { value: "friends" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));

    await waitFor(() =>
      expect(api.updateProfile.mock.calls[0]?.[0]).toEqual({
        bio: "Arcade fan",
        platforms: ["PC"],
        favorite_genres: ["Roguelike"],
        library_visibility: "friends",
      }),
    );
  });

  it("clears local session data and returns to login on sign out", async () => {
    renderPage(<ProfilePage />);
    await screen.findByRole("heading", { name: "player@example.com" });

    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));

    expect(api.clearToken).toHaveBeenCalledOnce();
    expect(navigate).toHaveBeenCalledWith({ to: "/" });
  });

  it("keeps sign out available when the profile summary cannot load", async () => {
    api.getProfileSummary.mockRejectedValue({ status: 500 });
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const clear = vi.spyOn(client, "clear");
    render(
      <QueryClientProvider client={client}>
        <ProfilePage />
      </QueryClientProvider>,
    );

    expect(
      await screen.findByText("Sign in to view your profile."),
    ).toBeVisible();
    fireEvent.click(await screen.findByRole("button", { name: "Sign out" }));

    expect(api.clearToken).toHaveBeenCalledOnce();
    expect(clear).toHaveBeenCalledOnce();
    expect(navigate).toHaveBeenCalledWith({ to: "/" });
  });

  it("shows an error when the protected library request fails", async () => {
    api.getLibraryOverview.mockRejectedValue({ status: 401 });
    renderPage(<LibraryPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "could not be loaded",
    );
  });

  it("shows a Steam sign-in action when the dashboard request returns 401", async () => {
    api.getDashboard.mockRejectedValue({ status: 401 });
    renderPage(<SteamLibraryPanel />);
    expect(await screen.findByText("Sign in", { selector: "a" })).toBeVisible();
  });

  it("sends guests to sign in instead of opening the protected Steam linker", async () => {
    api.isAuthenticated.mockReturnValue(false);
    renderPage(<SteamLibraryPanel />);

    expect(screen.getByText("Sign in", { selector: "a" })).toHaveAttribute(
      "to",
      "/login",
    );
    expect(
      screen.queryByRole("button", { name: "Connect Steam" }),
    ).not.toBeInTheDocument();
  });

  it("shows the public homepage for guests", async () => {
    api.isAuthenticated.mockReturnValue(false);
    renderPage(<Dashboard />);

    expect(
      await screen.findByRole("heading", { name: "Find your next game" }),
    ).toBeVisible();
    expect(api.getDashboard).not.toHaveBeenCalled();
  });

  it("renders the library overview with All selected initially", async () => {
    renderPage(<LibraryPage />);
    expect(await screen.findByRole("button", { name: "All" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(await screen.findByText("Hades II")).toBeVisible();
    expect(screen.queryByText("Data unavailable")).not.toBeInTheDocument();
  });

  it("uses the dashboard steam block for its not-connected state", async () => {
    api.getDashboard.mockResolvedValue({
      ...dashboard(),
      steam: disconnected("Connect Steam to sync your library."),
    });
    renderPage(<SteamLibraryPanel />);
    expect(
      (await screen.findAllByText("Connect Steam to sync your library."))
        .length,
    ).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Connect Steam" })).toBeVisible();
    expect(screen.queryByText("Data unavailable")).not.toBeInTheDocument();
  });

  it("filters Steam games", async () => {
    api.getLibraryOverview.mockResolvedValue({
      games: [
        {
          id: "s",
          source: "steam",
          external_id: "1",
          detail_game_id: null,
          title: "Steam game",
          cover_url: null,
          playtime_forever: 1,
        },
        {
          id: "p",
          source: "psn",
          external_id: "p",
          detail_game_id: "p",
          title: "PSN game",
          cover_url: null,
          playtime_forever: null,
        },
      ],
      steam_available: true,
      steam_error: null,
    });
    renderPage(<LibraryPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Steam" }));
    expect(screen.getByText("Steam game")).toBeVisible();
    expect(screen.queryByText("PSN game")).not.toBeInTheDocument();
  });

  it("shows a source-specific empty state", async () => {
    renderPage(<LibraryPage />);
    fireEvent.click(await screen.findByRole("button", { name: "PSN" }));
    expect(
      await screen.findByText("No PSN games are in your library yet."),
    ).toBeVisible();
  });

  it("renders the reusable Steam library panel for a connected dashboard", async () => {
    api.getDashboard.mockResolvedValue({
      ...dashboard(),
      steam: ready({
        steam,
        games: [
          {
            appid: 1145350,
            name: "Hades II",
            playtime_forever: 125,
            img_icon_url: null,
          },
        ],
      }),
    });

    renderPage(<SteamLibraryPanel />);

    expect(await screen.findByText("Steam library")).toBeVisible();
    expect(screen.getByRole("button", { name: "Sync now" })).toBeVisible();
  });

  it("shows the Steam connected message in the reusable panel", async () => {
    renderPage(<SteamLibraryPanel linked="1" />);

    expect(
      await screen.findByText(
        "Steam account connected. Your library is ready to sync.",
      ),
    ).toBeVisible();
  });
});
