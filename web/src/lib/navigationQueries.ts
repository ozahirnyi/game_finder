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

export const steamSocialFirstPageQueryOptions = () => ({
  queryKey: ["steam-social"] as const,
  queryFn: () => getSteamSocial(12, 0),
  staleTime: NAVIGATION_STALE_TIME,
});
