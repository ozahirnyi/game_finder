import { describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  getFriends: vi.fn(),
  getIncomingFriendRequests: vi.fn(),
  getLibraryOverview: vi.fn(),
  getSteamSocial: vi.fn().mockResolvedValue({}),
}));

vi.mock("./api", () => api);
import {
  friendsQueryOptions,
  incomingFriendRequestsQueryOptions,
  libraryOverviewQueryOptions,
  steamSocialInfiniteQueryOptions,
} from "./navigationQueries";

describe("navigation query options", () => {
  it("keeps navigation data fresh for 90 seconds", () => {
    expect(libraryOverviewQueryOptions().staleTime).toBe(90_000);
    expect(libraryOverviewQueryOptions().queryKey).toEqual(["library-overview"]);
    expect(friendsQueryOptions().staleTime).toBe(90_000);
    expect(incomingFriendRequestsQueryOptions().staleTime).toBe(90_000);
    expect(steamSocialInfiniteQueryOptions().staleTime).toBe(90_000);
  });

  it("uses the first Steam social page for navigation prefetching", async () => {
    const options = steamSocialInfiniteQueryOptions();

    await expect(options.queryFn({ pageParam: 0 })).resolves.toBeDefined();
    expect(api.getSteamSocial).toHaveBeenCalledWith(12, 0);
  });
});
