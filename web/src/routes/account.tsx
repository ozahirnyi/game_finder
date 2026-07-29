import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { ProfileView } from "@/components/ProfileView";
import { ConnectedServices } from "@/components/ConnectedServices";
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

  if (!profile) {
    return (
      <AppShell>
        <p className="text-sm text-muted-foreground">Loading your profile…</p>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <ProfileView
        isSelf
        profile={{
          name: profile.display_name,
          handle: profile.display_name,
          avatarFrom: "#e85d3a",
          avatarTo: "#7c2d12",
          region: profile.platforms[0] ?? "Global",
          bio: profile.bio ?? undefined,
          hours: Math.round(
            owned.reduce((total, game) => total + (game.playtime_forever ?? 0), 0) / 60,
          ),
          games: owned as never,
          stores: [
            {
              name: "Steam",
              count: owned.filter((g) => g.source === "steam").length,
              note: "Library source",
            },
            {
              name: "PlayStation",
              count: owned.filter((g) => g.source === "psn").length,
              note: "Imported library source",
            },
          ],
        }}
      />
      <div className="mt-6">
        <ConnectedServices />
      </div>
    </AppShell>
  );
}
