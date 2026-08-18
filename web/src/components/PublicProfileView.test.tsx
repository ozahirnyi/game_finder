import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PublicProfile } from "@/lib/api";

const api = vi.hoisted(() => ({ createSocialFriendRequest: vi.fn().mockResolvedValue({}) }));
vi.mock("@/lib/api", async () => ({
  ...(await vi.importActual<typeof import("@/lib/api")>("@/lib/api")),
  ...api,
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    params,
    search,
  }: {
    children: React.ReactNode;
    params: { gameId: string };
    search: { title: string };
  }) => (
    <a href={`/games/${params.gameId}?title=${encodeURIComponent(search.title)}`}>{children}</a>
  ),
}));
import { PublicProfileView } from "./PublicProfileView";

function profile(overrides: Partial<PublicProfile> = {}): PublicProfile {
  return {
    public_id: "owner",
    nickname: "Owner",
    relationship: "none",
    library: { status: "empty", data: [], message: null },
    favorites: { status: "empty", data: [], message: null },
    wishlist: { status: "empty", data: [], message: null },
    steam: { status: "empty", data: null, message: null },
    ...overrides,
  };
}

function renderProfile(overrides: Partial<PublicProfile> = {}, isAuthenticated = false) {
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <PublicProfileView profile={profile(overrides)} isAuthenticated={isAuthenticated} />
    </QueryClientProvider>,
  );
}

describe("PublicProfileView", () => {
  afterEach(cleanup);

  it("sends a friend request only for an eligible authenticated viewer", async () => {
    render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <PublicProfileView
          profile={{
            public_id: "owner",
            nickname: "Owner",
            relationship: "none",
            library: { status: "empty", data: [], message: null },
            favorites: { status: "empty", data: [], message: null },
            wishlist: { status: "empty", data: [], message: null },
            steam: { status: "empty", data: null, message: null },
          }}
          isAuthenticated
        />
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Add friend" }));
    await waitFor(() => expect(api.createSocialFriendRequest).toHaveBeenCalledWith("owner"));
  });

  it("renders a hidden section without leaking its data", () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <PublicProfileView
          profile={{
            public_id: "owner",
            nickname: "Owner",
            relationship: "none",
            library: {
              status: "empty",
              data: [],
              message: "No library games have been saved yet.",
            },
            favorites: {
              status: "hidden",
              data: [
                {
                  id: "1",
                  catalog_game_id: 1,
                  source: "igdb",
                  external_id: "1",
                  title: "Secret Favorite",
                  cover_url: "https://cover.test/private.jpg",
                },
              ],
              message: "This section is private.",
            },
            wishlist: {
              status: "empty",
              data: [],
              message: "No wishlist games have been saved yet.",
            },
            steam: {
              status: "hidden",
              data: { linked: true, persona_name: "76561198000000000" },
              message: "This section is private.",
            },
          }}
          isAuthenticated={false}
        />
      </QueryClientProvider>,
    );

    expect(screen.getAllByText("This section is private.")).toHaveLength(2);
    expect(screen.queryByText("Secret Favorite")).not.toBeInTheDocument();
    expect(screen.queryByText("76561198000000000")).not.toBeInTheDocument();
  });

  it("shows the player's identity and a compact empty collection card", () => {
    renderProfile({
      nickname: "Kinder",
      library: { status: "empty", data: [], message: "No library games have been saved yet." },
    });

    expect(screen.getByRole("heading", { name: "Kinder" })).toBeInTheDocument();
    expect(screen.getByTestId("public-profile-library")).toHaveClass("p-6");
    expect(screen.getByText("No library games have been saved yet.")).toBeInTheDocument();
  });

  it("renders an authorized collection game as an internal game link", () => {
    renderProfile({
      favorites: {
        status: "ready",
        data: [
          {
            id: "favorite-1",
            catalog_game_id: 42,
            source: "igdb",
            external_id: "42",
            title: "Hades II",
          },
        ],
        message: null,
      },
    });

    expect(screen.getByRole("link", { name: "Hades II" })).toHaveAttribute(
      "href",
      "/games/42?title=Hades%20II",
    );
  });

  it("keeps anonymous viewers unactionable and gives the owner a settings path", () => {
    const { rerender } = renderProfile();
    expect(screen.queryByRole("button", { name: "Add friend" })).not.toBeInTheDocument();

    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <PublicProfileView profile={profile({ relationship: "self" })} isAuthenticated />
      </QueryClientProvider>,
    );

    expect(screen.getByRole("link", { name: "Profile settings" })).toHaveAttribute(
      "href",
      "/account",
    );
  });
});
