import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { ProfileView } from "@/components/ProfileView";
import { getLibrary, getProfile } from "@/lib/api";

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

function AccountPage() {
  const profileQuery = useQuery({ queryKey: ["profile"], queryFn: getProfile });
  const libraryQuery = useQuery({ queryKey: ["library"], queryFn: getLibrary });
  const profile = profileQuery.data;
  const owned = libraryQuery.data ?? [];

  return (
    <AppShell>
      <ProfileView
        isSelf
        profile={{
          name: profile?.display_name ?? "Your profile",
          handle: profile?.display_name ?? "profile",
          avatarFrom: "#7c3aed",
          avatarTo: "#111827",
          region: "US",
          hours: owned.reduce((total, game) => total + (game.playtime_forever ?? 0), 0) / 60,
          games: owned.map((game) => ({
            id: game.id,
            title: game.title,
            coverFrom: "#1d4ed8",
            coverTo: "#111827",
            coverUrl: game.cover_url ?? undefined,
            playtime: game.playtime_forever == null ? null : game.playtime_forever / 60,
            source: game.source,
          })),
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
