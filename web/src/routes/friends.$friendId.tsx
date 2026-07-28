import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { ProfileView } from "@/components/ProfileView";
import { activity, friendBios, friendGames, friends } from "@/lib/mockData";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/friends/$friendId")({
  loader: ({ params }) => {
    const friend = friends.find((f) => f.id === params.friendId);
    if (!friend) throw notFound();
    return { friend };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [{ title: "Player not found — Playfinder" }, { name: "robots", content: "noindex" }],
      };
    }
    const { friend } = loaderData;
    const title = `${friend.name} (@${friend.handle}) — Playfinder`;
    const description = `${friend.name}'s Playfinder profile: shared games, compatibility and recent activity.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "profile" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  notFoundComponent: FriendNotFound,
  component: FriendProfilePage,
});

function FriendNotFound() {
  return (
    <AppShell>
      <div className="rounded-2xl border border-border bg-surface p-10 text-center">
        <h1 className="text-xl font-bold">Player not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This profile doesn’t exist or is private.
        </p>
        <Link
          to="/friends"
          className="mt-5 inline-flex rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground"
        >
          Back to friends
        </Link>
      </div>
    </AppShell>
  );
}

function FriendProfilePage() {
  const { friend } = Route.useLoaderData();
  const owned = friendGames(friend.id);

  return (
    <AppShell>
      <Link
        to="/friends"
        className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Friends
      </Link>
      <ProfileView
        isSelf={false}
        profile={{
          name: friend.name,
          handle: friend.handle,
          avatarFrom: friend.avatarFrom,
          avatarTo: friend.avatarTo,
          region: friend.platforms.includes("PS5") ? "EU" : "US",
          online: friend.online,
          bio: friendBios[friend.id],
          compatibility: friend.compatibility,
          hours: `${friend.sharedGames * 27}`,
          games: owned,
          stores: [
            {
              name: "Steam",
              count: owned.filter((g) => g.source === "Steam").length,
              note: friend.online ? "Online now" : "Last synced today",
            },
            {
              name: "PlayStation",
              count: owned.filter((g) => g.source === "PlayStation").length,
              note: "Synced yesterday",
            },
          ],
          activity: activity
            .filter((a) => a.who === friend.id)
            .map((a) => ({
              id: a.id,
              text: `${a.verb} ${a.target} ${a.tag}`,
              time: a.time,
            })),
        }}
      />
    </AppShell>
  );
}
