import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

const { getProfile, getLibraryOverview, getFavorites, profileView } = vi.hoisted(() => ({
  getProfile: vi.fn().mockResolvedValue({ display_name: "test1" }),
  getLibraryOverview: vi.fn().mockResolvedValue({
    steam_available: true,
    steam_error: null,
    games: [
      {
        id: "steam:620",
        source: "steam",
        external_id: "620",
        detail_game_id: null,
        title: "Portal 2",
        cover_url: null,
        playtime_forever: 180,
      },
      {
        id: "manual:1",
        source: "manual",
        external_id: null,
        detail_game_id: "manual:1",
        title: "Hades",
        cover_url: null,
        playtime_forever: 60,
      },
    ],
  }),
  getFavorites: vi.fn().mockResolvedValue([
    {
      id: "favorite-1",
      catalog_game_id: 274755,
      source: "igdb",
      external_id: "274755",
      title: "Hades II",
      cover_url: null,
    },
  ]),
  profileView: vi.fn((_props: unknown) => null),
}));

vi.mock("@/lib/api", () => ({ getProfile, getLibraryOverview, getFavorites }));
vi.mock("@/components/AppShell", () => ({
  AppShell: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock("@/components/ProfileView", () => ({
  ProfileView: (props: unknown) => profileView(props),
}));

import { AccountPage } from "./account";

describe("AccountPage", () => {
  it("uses the unified overview for Steam counts and playtime", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <AccountPage />
      </QueryClientProvider>,
    );

    await waitFor(() => expect(getLibraryOverview).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(getFavorites).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(profileView).toHaveBeenLastCalledWith(
        expect.objectContaining({
          isSelf: true,
          profile: expect.objectContaining({
            hours: "4h",
            games: expect.arrayContaining([
              expect.objectContaining({ id: "steam:620", source: "steam", playtime: 3 }),
            ]),
            stores: expect.arrayContaining([expect.objectContaining({ name: "Steam", count: 1 })]),
            favorites: [expect.objectContaining({ title: "Hades II", catalog_game_id: 274755 })],
          }),
        }),
      ),
    );
  });
});
