import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

const api = vi.hoisted(() => ({
  getSteamAccount: vi.fn(),
  getSteamLibrary: vi.fn(),
  syncSteamLibrary: vi.fn(),
  getSteamSocial: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => options,
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
}));
vi.mock("@/components/AppShell", () => ({ AppShell: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("@/components/GameCover", () => ({
  Avatar: ({ name }: { name: string }) => <span>{name}</span>,
  GameCover: ({ title }: { title: string }) => <span>{title}</span>,
}));
vi.mock("@/components/ui-bits", () => ({
  Chip: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  PresenceDot: () => <span />,
  SectionHeader: ({ title, hint, action }: { title: string; hint?: string; action?: React.ReactNode }) => <section><h2>{title}</h2><p>{hint}</p>{action}</section>,
}));
vi.mock("@/lib/api", () => api);

import { Route as FriendsRoute } from "../routes/friends";
import { Route as SteamRoute } from "../routes/steam";

function renderRoute(Component: React.ComponentType) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><Component /></QueryClientProvider>);
}

describe("Steam and Friends routes", () => {
  beforeEach(() => {
    api.getSteamAccount.mockResolvedValue({ linked: true, steam_id: "1", persona_name: "Niko", avatar: null, country_code: null, linked_at: null });
    api.getSteamLibrary.mockResolvedValue({ steam: { linked: true, steam_id: "1", persona_name: "Niko", avatar: null, country_code: null, linked_at: null }, games: [{ appid: 10, name: "Portal 2", playtime_forever: 120, playtime_2weeks: 20, img_icon_url: null }] });
    api.syncSteamLibrary.mockResolvedValue({ steam: { linked: true, steam_id: "1", persona_name: "Niko", avatar: null, country_code: null, linked_at: null }, games: [], created: 0, updated: 0, removed: 0, synced_at: null });
    api.getSteamSocial.mockResolvedValue({ steam: { linked: true, steam_id: "1", persona_name: "Niko", avatar: null, country_code: null, linked_at: null }, friends: [{ steam_id: "2", persona_name: "Ada", avatar: null, friend_since: null, library_public: true, games_count: 12, common_games_count: 1, taste_match_percent: 75, common_games: [{ appid: 10, name: "Portal 2", playtime_forever: 100, playtime_2weeks: 0, img_icon_url: null }], top_games: [] }], top_friend_games: [], public_libraries: 1, private_libraries: 0 });
  });

  test("renders only returned Steam account and library data", async () => {
    renderRoute((SteamRoute as { component: React.ComponentType }).component);

    await waitFor(() => expect(screen.getByText("Portal 2")).toBeInTheDocument());
    expect(screen.getByText(/Niko/)).toBeInTheDocument();
    expect(screen.getByText(/1 games synced/)).toBeInTheDocument();
    expect(screen.queryByText(/342 titles/)).not.toBeInTheDocument();
  });

  test("shows a Steam connect CTA when the library reports an unlinked account", async () => {
    api.getSteamLibrary.mockRejectedValue({ status: 409 });
    renderRoute((SteamRoute as { component: React.ComponentType }).component);

    expect(await screen.findByRole("link", { name: /connect steam/i })).toHaveAttribute("href", "/steam");
  });

  test("shows an explicit signed-out Steam state", async () => {
    api.getSteamAccount.mockRejectedValue({ status: 401 });
    renderRoute((SteamRoute as { component: React.ComponentType }).component);

    expect(await screen.findByText(/session is signed out/i)).toBeInTheDocument();
  });

  test("renders Steam friend and shared-game records without fabricated activity", async () => {
    renderRoute((FriendsRoute as { component: React.ComponentType }).component);

    await waitFor(() => expect(screen.getAllByText("Ada").length).toBeGreaterThan(0));
    expect(screen.getAllByText("Portal 2").length).toBeGreaterThan(0);
    expect(screen.queryByText(/Helldivers 2 launched/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add friend" })).toBeDisabled();
  });

  test("shows a Steam connect CTA when friends are unavailable because Steam is unlinked", async () => {
    api.getSteamSocial.mockRejectedValue({ status: 409 });
    renderRoute((FriendsRoute as { component: React.ComponentType }).component);

    expect(await screen.findByRole("link", { name: /connect steam/i })).toHaveAttribute("href", "/steam");
  });
});
