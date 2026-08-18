import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
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
  const publicQuery = useQuery({
    queryKey: ["public-profile", publicId],
    queryFn: () => getPublicProfile(publicId),
  });
  const publicProfile = publicQuery.data;
  const friendQuery = useQuery({
    queryKey: ["friend-profile", publicId],
    queryFn: () => getFriendProfileByPublicId(publicId),
    enabled: publicProfile?.relationship === "friends",
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
  if (
    publicProfile.relationship === "friends" &&
    (friendQuery.isLoading || friendQuery.isError || !friendQuery.data)
  )
    return (
      <AppShell>
        <Skeleton className="h-80 w-full" />
      </AppShell>
    );

  const friend = friendQuery.data?.user;
  const library = friendQuery.data?.library ?? publicProfile.library;
  const games: ProfileData["games"] = library.data.map((game) => ({
    id: game.id,
    title: game.title,
    coverFrom: "#7c3aed",
    coverTo: "#111827",
    coverUrl: game.cover_url ?? undefined,
    playtime: game.playtime_forever,
    source: game.source,
  }));
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
    hours: games.length ? `${games.length} games` : "—",
    games,
    friendId: friend?.id,
    sharedLibrary: sharedQuery.data,
    favorites: isSelf ? publicProfile.favorites.data : undefined,
    stores: [
      {
        name: "Steam",
        count: games.filter((game) => game.source?.toLowerCase() === "steam").length,
        note: "Synced games",
      },
      {
        name: "PlayStation",
        count: games.filter((game) =>
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
