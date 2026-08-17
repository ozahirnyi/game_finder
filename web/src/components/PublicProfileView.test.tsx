import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ createSocialFriendRequest: vi.fn().mockResolvedValue({}) }));
vi.mock("@/lib/api", async () => ({ ...(await vi.importActual<typeof import("@/lib/api")>("@/lib/api")), ...api }));
import { PublicProfileView } from "./PublicProfileView";

describe("PublicProfileView", () => {
  it("sends a friend request only for an eligible authenticated viewer", async () => {
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
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
      <QueryClientProvider client={new QueryClient()}><PublicProfileView
        profile={{
          public_id: "owner",
          nickname: "Owner",
          relationship: "none",
          library: { status: "empty", data: [], message: "No library games have been saved yet." },
          favorites: {
            status: "hidden",
            data: [{ id: "1", catalog_game_id: 1, source: "igdb", external_id: "1", title: "Secret Favorite", cover_url: "https://cover.test/private.jpg" }],
            message: "This section is private.",
          },
          wishlist: { status: "empty", data: [], message: "No wishlist games have been saved yet." },
          steam: { status: "hidden", data: { linked: true, persona_name: "76561198000000000" }, message: "This section is private." },
        }}
        isAuthenticated={false}
      /></QueryClientProvider>,
    );

    expect(screen.getAllByText("This section is private.")).toHaveLength(2);
    expect(screen.queryByText("Secret Favorite")).not.toBeInTheDocument();
    expect(screen.queryByText("76561198000000000")).not.toBeInTheDocument();
  });
});
