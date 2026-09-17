import { createFileRoute, Navigate } from "@tanstack/react-router";
import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { ProfileView, type ProfileData } from "@/components/ProfileView";
import { ErrorState, Skeleton } from "@/components/ui-bits";
import {
  createSocialFriendRequest,
  getAuthSnapshot,
  getFriendProfileByPublicId,
  getProfile,
  getPublicProfile,
  getSharedGames,
} from "@/lib/api";
import { profileLibraryGames, profileLibraryHours } from "@/lib/profileLibrary";
import { friendDisplayName } from "@/lib/friendIdentity";

export const Route = createFileRoute("/users/$publicId")({
  validateSearch: (search: Record<string, unknown>): { compose?: "message" | "invite" } => ({
    ...(search.compose === "message" || search.compose === "invite"
      ? { compose: search.compose }
      : {}),
  }),
  component: PublicProfilePage,
});

function PublicProfilePage() {
  const { publicId } = Route.useParams();
  const { compose } = Route.useSearch();
  const [libraryPage, setLibraryPage] = useState(1);
  const [librarySearch, setLibrarySearch] = useState("");
  const [debouncedLibrarySearch, setDebouncedLibrarySearch] = useState("");
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedLibrarySearch(librarySearch);
      setLibraryPage(1);
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [librarySearch]);
  const publicQuery = useQuery({
    queryKey: ["public-profile", publicId],
    queryFn: () => getPublicProfile(publicId),
  });
  const publicProfile = publicQuery.data;
  const friendQuery = useQuery({
    queryKey: ["friend-profile", publicId, libraryPage, debouncedLibrarySearch],
    queryFn: () => getFriendProfileByPublicId(publicId, libraryPage, debouncedLibrarySearch),
    enabled: publicProfile?.relationship === "friends",
    placeholderData: keepPreviousData,
  });
  const sharedQuery = useQuery({
    queryKey: ["shared-games", friendQuery.data?.user.id],
    queryFn: () => getSharedGames(friendQuery.data!.user.id),
    enabled: Boolean(friendQuery.data),
  });
  const ownerQuery = useQuery({
    queryKey: ["profile"],
    queryFn: getProfile,
    enabled: publicProfile?.relationship === "self",
  });
  const addFriend = useMutation({ mutationFn: () => createSocialFriendRequest(publicId) });
  if (publicQuery.isLoading)
    return (
      <AppShell>
        <Skeleton className="h-80 w-full" />
      </AppShell>
    );
  if (publicQuery.isError || !publicProfile)
    return (
      <AppShell>
        <ErrorState
          title="Profile unavailable"
          description="This profile is no longer available."
        />
      </AppShell>
    );
  if (publicProfile.relationship === "friends" && friendQuery.isLoading && !friendQuery.data)
    return (
      <AppShell>
        <Skeleton className="h-80 w-full" />
      </AppShell>
    );

  const friend = friendQuery.data?.user;
  const library = friendQuery.data?.library ?? publicProfile.library;
  const games = profileLibraryGames(library.data);
  if (compose === "message" && friend)
    return <Navigate to="/messages" search={{ friend: friend.id }} replace />;
  const isSelf = publicProfile.relationship === "self";
  const name = friend ? friendDisplayName(friend) : publicProfile.nickname;
  const profile: ProfileData = {
    name,
    handle: name,
    avatarFrom: "#7c3aed",
    avatarTo: "#111827",
    avatarUrl: friend?.avatar ?? publicProfile.avatar ?? undefined,
    bio: friend?.bio ?? undefined,
    region: "Global",
    hours: friendQuery.data?.library.summary?.total_playtime ?? profileLibraryHours(library.data),
    libraryMessage: friendQuery.isError
      ? "Could not load this library. Please retry."
      : library.message ?? undefined,
    libraryPagination: friendQuery.data || publicProfile.relationship === "friends"
      ? {
          page: friendQuery.data?.library.page ?? libraryPage,
          pageSize: friendQuery.data?.library.page_size ?? 12,
          total: friendQuery.data?.library.total ?? library.data.length,
          summary: friendQuery.data?.library.summary
            ? {
                totalGames: friendQuery.data.library.summary.total_games,
                totalPlaytime: friendQuery.data.library.summary.total_playtime,
                platformCounts: friendQuery.data.library.summary.platform_counts,
              }
            : undefined,
          query: librarySearch,
          onQueryChange: (query) => {
            setLibrarySearch(query);
          },
          onPageChange: setLibraryPage,
          onRetry: () => void friendQuery.refetch(),
          isFetching: friendQuery.isFetching,
        }
      : undefined,
    games,
    friendId: friend?.id ?? (publicProfile.relationship === "friends" ? publicProfile.user_id : undefined),
    userId: friend?.id ?? publicProfile.user_id,
    sharedLibrary: sharedQuery.data,
    steamProfileUrl:
      publicProfile.steam?.status === "ready"
        ? (publicProfile.steam.data?.profile_url ?? undefined)
        : undefined,
    favorites: isSelf ? publicProfile.favorites.data : undefined,
    stores: [
      {
        name: "Steam",
        count: friendQuery.data?.library.summary?.platform_counts.steam ?? games.filter((game) => game.source?.toLowerCase() === "steam").length,
        note: "Synced games",
      },
      {
        name: "PlayStation",
        count: friendQuery.data?.library.summary?.platform_counts.psn ?? games.filter((game) =>
          ["psn", "playstation"].includes(game.source?.toLowerCase() ?? ""),
        ).length,
        note: "Synced games",
      },
    ],
    settings:
      isSelf && ownerQuery.data
        ? {
            displayName: ownerQuery.data.display_name,
            bio: ownerQuery.data.bio ?? "",
            libraryVisibility: ownerQuery.data.library_visibility ?? "public",
            favoritesVisibility: ownerQuery.data.favorites_visibility ?? "public",
            wishlistVisibility: ownerQuery.data.wishlist_visibility ?? "public",
            steamVisibility: ownerQuery.data.steam_visibility ?? "public",
            platforms: ownerQuery.data.platforms,
            favoriteGenres: ownerQuery.data.favorite_genres,
          }
        : undefined,
  };
  return (
    <AppShell>
      <ProfileView
        profile={profile}
        isSelf={isSelf}
        initialComposer={compose}
        viewer={{
          canMessage: publicProfile.relationship === "friends",
          canInvite: publicProfile.relationship === "friends",
          canAddFriend: publicProfile.relationship === "none" && getAuthSnapshot(),
          onAddFriend: () => addFriend.mutate(),
        }}
      />
    </AppShell>
  );
}
