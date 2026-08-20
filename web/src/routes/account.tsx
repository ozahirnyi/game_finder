import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { OnboardingGuidance } from "@/components/OnboardingGuidance";
import { ProfileView } from "@/components/ProfileView";
import { getFavorites, getLibraryOverview, getOnboardingSummary, getProfile } from "@/lib/api";
import { libraryPlaytime } from "@/lib/collectionPresentation";

export const Route = createFileRoute("/account")({
  head: () => ({
    meta: [
      { title: "Your profile — Playfinder" },
      {
        name: "description",
        content:
          "Your Playfinder profile: synced library stats, connected stores, appearance and alert preferences.",
      },
      { property: "og:title", content: "Your profile — Playfinder" },
      {
        property: "og:description",
        content: "Manage your Playfinder profile, connected stores and theme.",
      },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AccountPage,
});

export function AccountPage() {
  const profileQuery = useQuery({ queryKey: ["profile"], queryFn: getProfile });
  const libraryQuery = useQuery({ queryKey: ["library-overview"], queryFn: getLibraryOverview });
  const favoritesQuery = useQuery({ queryKey: ["favorites"], queryFn: getFavorites });
  const onboardingQuery = useQuery({
    queryKey: ["onboarding-summary"],
    queryFn: getOnboardingSummary,
  });
  const profile = profileQuery.data;
  const owned = libraryQuery.data?.games ?? [];

  return (
    <AppShell>
      <OnboardingGuidance
        compact
        summary={onboardingQuery.data}
        isPending={onboardingQuery.isPending}
        isError={onboardingQuery.isError}
        onRetry={() => {
          void onboardingQuery.refetch();
        }}
      />
      <ProfileView
        isSelf
        profile={{
          name: profile?.display_name ?? "Your profile",
          handle: profile?.display_name ?? "profile",
          avatarFrom: "#7c3aed",
          avatarTo: "#111827",
          region: "US",
          settings: profile
            ? {
                displayName: profile.display_name,
                bio: profile.bio ?? "",
                libraryVisibility: profile.library_visibility ?? "public",
                favoritesVisibility: profile.favorites_visibility ?? "public",
                wishlistVisibility: profile.wishlist_visibility ?? "public",
                steamVisibility: profile.steam_visibility ?? "public",
                platforms: profile.platforms,
                favoriteGenres: profile.favorite_genres,
              }
            : undefined,
          hours: libraryPlaytime(
            owned.reduce((total, game) => total + (game.playtime_forever ?? 0), 0),
          ),
          games: owned.map((game) => ({
            id: game.id,
            title: game.title,
            coverFrom: "#1d4ed8",
            coverTo: "#111827",
            coverUrl: game.cover_url ?? undefined,
            playtime: game.playtime_forever == null ? null : Math.floor(game.playtime_forever / 60),
            source: game.source,
          })),
          favorites: favoritesQuery.data ?? [],
          stores: [
            {
              name: "Steam",
              count: owned.filter((g) => g.source.toLowerCase() === "steam").length,
              note: "Synced 4m ago",
            },
            {
              name: "PlayStation",
              count: owned.filter((g) => ["psn", "playstation"].includes(g.source.toLowerCase()))
                .length,
              note: "Synced 1h ago",
            },
          ],
        }}
      />
    </AppShell>
  );
}
