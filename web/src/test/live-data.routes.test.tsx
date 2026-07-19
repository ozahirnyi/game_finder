import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Dashboard } from "@/routes/index";
import { LibraryPage } from "@/routes/library";
import { ProfilePage } from "@/routes/profile";
import { Route as SteamRoute } from "@/routes/steam";

const api = vi.hoisted(() => ({
  getDashboard: vi.fn(),
  getProfileSummary: vi.fn(),
  syncSteamLibrary: vi.fn(),
  updateProfile: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => options,
  Link: ({ children, ...props }: React.ComponentProps<"a">) => <a {...props}>{children}</a>,
}));
vi.mock("@/components/AppShell", () => ({ AppShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }));
vi.mock("@/lib/api", () => api);

const ready = (data: unknown) => ({ status: "ready", data, message: null });
const empty = (message: string) => ({ status: "empty", data: null, message });
const disconnected = (message: string) => ({ status: "not_connected", data: null, message });
const game = { id: "saved-1", title: "Hades II", notes: null, info: null, source: "steam", external_id: "1145350", playtime_forever: 125, playtime_2weeks: null, img_icon_url: null, synced_at: null, created_at: "2026-07-16T00:00:00Z" };
const steam = { linked: true, steam_id: "1", persona_name: "Niko", avatar: null, country_code: null, linked_at: null };

function summary() {
  return {
    account: ready({ user: { id: "user-1", email: "player@example.com", created_at: "2026-01-01", google_linked: false } }),
    profile: ready({ bio: "Arcade fan", platforms: ["PC"], favorite_genres: ["Roguelike"] }),
    services: ready({ steam, telegram: { linked: false, configured: true, username: null, linked_at: null }, google: { linked: true }, psn_games: 0 }),
    library: ready({ games: [game], total_games: 1, total_playtime_hours: 2, manual_games: 0, psn_games: 0 }),
    favorites: ready([game]), wishlist: empty("No wishlist games yet."), recently_played: ready([{ appid: 1145350, name: "Hades II", playtime_forever: 125, playtime_2weeks: 0, img_icon_url: null }]),
  };
}

function dashboard() {
  return {
    user: ready({ id: "user-1", email: "player@example.com", created_at: "2026-01-01", google_linked: false }),
    library: ready({ games: [game], total_games: 1, total_playtime_hours: 2, manual_games: 0, psn_games: 0 }),
    recommendations: ready({ recommendations: [{ title: "Balatro", reason: "Because you enjoy roguelikes", tags: ["Cards"] }] }),
    deals: empty("No price drops yet."), steam: disconnected("Connect Steam to sync your library."), social: disconnected("Connect Steam to see friends."),
  };
}

function renderPage(view: React.ReactElement) {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{view}</QueryClientProvider>);
}

describe("live dashboard and profile data", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getDashboard.mockResolvedValue(dashboard());
    api.getProfileSummary.mockResolvedValue(summary());
  });

  it("renders dashboard blocks from the summary response and useful disconnected states", async () => {
    renderPage(<Dashboard />);
    expect((await screen.findAllByText("Balatro")).length).toBeGreaterThan(0);
    expect(screen.getByText("No price drops yet.")).toBeVisible();
    expect(screen.getAllByText("Connect Steam").length).toBeGreaterThan(0);
    expect(screen.queryByText("Data unavailable")).not.toBeInTheDocument();
  });

  it("renders profile and library values from the profile summary without demo cards", async () => {
    renderPage(<ProfilePage />);
    expect(await screen.findByRole("heading", { name: "player@example.com" })).toBeVisible();
    expect(screen.getByText("Arcade fan")).toBeVisible();
    expect(screen.getAllByText("Hades II").length).toBeGreaterThan(0);
    expect(screen.getByText("No wishlist games yet.")).toBeVisible();
    expect(screen.getByText("Google").parentElement).toHaveTextContent("Connected");
    expect(screen.queryByText("Data unavailable")).not.toBeInTheDocument();
  });

  it("saves editable profile fields and refreshes the summary", async () => {
    api.updateProfile.mockResolvedValue({ bio: "Updated bio", platforms: ["PC"], favorite_genres: ["Puzzle"] });
    renderPage(<ProfilePage />);
    await screen.findByRole("heading", { name: "player@example.com" });
    fireEvent.click(screen.getByRole("button", { name: /edit profile/i }));
    fireEvent.change(screen.getByLabelText("Bio"), { target: { value: "Updated bio" } });
    fireEvent.click(screen.getByRole("button", { name: "Puzzle" }));
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));
    await waitFor(() => expect(api.updateProfile.mock.calls[0]?.[0]).toEqual({ bio: "Updated bio", platforms: ["PC"], favorite_genres: ["Roguelike", "Puzzle"] }));
  });

  it("shows a sign-in action when protected summary requests return 401", async () => {
    api.getProfileSummary.mockRejectedValue({ status: 401 });
    api.getDashboard.mockRejectedValue({ status: 401 });
    renderPage(<LibraryPage />);
    expect(await screen.findByText("Sign in", { selector: "a" })).toBeVisible();
  });

  it("shows a Steam sign-in action when the dashboard request returns 401", async () => {
    api.getDashboard.mockRejectedValue({ status: 401 });
    const SteamPage = (SteamRoute as { component: React.ComponentType }).component;
    renderPage(<SteamPage />);
    expect(await screen.findByText("Sign in", { selector: "a" })).toBeVisible();
  });

  it("renders the library from its profile-summary block", async () => {
    renderPage(<LibraryPage />);
    expect(await screen.findByText("1 games synced")).toBeVisible();
    expect(screen.getAllByText("2h").length).toBeGreaterThan(0);
    expect(screen.getByText("Hades II")).toBeVisible();
    expect(screen.queryByText("Data unavailable")).not.toBeInTheDocument();
  });

  it("uses the dashboard steam block for its not-connected state", async () => {
    const SteamPage = (SteamRoute as { component: React.ComponentType }).component;
    renderPage(<SteamPage />);
    expect((await screen.findAllByText("Connect Steam to sync your library.")).length).toBeGreaterThan(0);
    expect(screen.getByText("Connect Steam", { selector: "a" })).toBeVisible();
    expect(screen.queryByText("Data unavailable")).not.toBeInTheDocument();
  });
});
