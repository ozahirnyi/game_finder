import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { ProfileView } from "@/components/ProfileView";
import { account, games } from "@/lib/mockData";

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
  const owned = games.filter((g) => g.source);

  return (
    <AppShell>
      <ProfileView
        isSelf
        profile={{
          name: account.name,
          handle: account.handle,
          avatarFrom: account.avatarFrom,
          avatarTo: account.avatarTo,
          region: account.region,
          hours: "2,140",
          games: owned,
          stores: [
            {
              name: "Steam",
              count: owned.filter((g) => g.source === "Steam").length,
              note: "Synced 4m ago",
            },
            {
              name: "PlayStation",
              count: owned.filter((g) => g.source === "PlayStation").length,
              note: "Synced 1h ago",
            },
          ],
        }}
      />
    </AppShell>
  );
}
