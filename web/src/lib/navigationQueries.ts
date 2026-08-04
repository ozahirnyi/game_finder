import { getFriends, getIncomingFriendRequests, getLibraryOverview, getSteamSocial } from "./api";

export const NAVIGATION_STALE_TIME = 90_000;

export const libraryOverviewQueryOptions = () => ({
  queryKey: ["library-overview"] as const,
  queryFn: getLibraryOverview,
  staleTime: NAVIGATION_STALE_TIME,
});

export const friendsQueryOptions = () => ({
  queryKey: ["friends"] as const,
  queryFn: getFriends,
  staleTime: NAVIGATION_STALE_TIME,
});

export const incomingFriendRequestsQueryOptions = () => ({
  queryKey: ["friend-requests", "incoming"] as const,
  queryFn: getIncomingFriendRequests,
  staleTime: NAVIGATION_STALE_TIME,
});

export const steamSocialInfiniteQueryOptions = () => ({
  queryKey: ["steam-social"] as const,
  queryFn: ({ pageParam }: { pageParam: number }) => getSteamSocial(12, pageParam),
  initialPageParam: 0,
  getNextPageParam: (
    lastPage: Awaited<ReturnType<typeof getSteamSocial>>,
    pages: Awaited<ReturnType<typeof getSteamSocial>>[],
  ) =>
    lastPage.friends_has_more
      ? pages.reduce((total, page) => total + page.friends.length, 0)
      : undefined,
  staleTime: NAVIGATION_STALE_TIME,
});
