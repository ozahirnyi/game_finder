import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { ProfileView, type ProfileData } from "@/components/ProfileView";
import { getFriends } from "@/lib/api";
import { friendDisplayName } from "@/lib/friendIdentity";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/friends/$friendId")({
  loader: async ({ params }) => {
    const friend = (await getFriends()).find(({ user }) => user.id === params.friendId)?.user;
    if (!friend) throw notFound();
    return {
      friend: {
        id: friend.id,
        name: friendDisplayName(friend),
        handle: friendDisplayName(friend),
        avatarFrom: "#7c3aed",
        avatarTo: "#111827",
      },
    };
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
  const owned: ProfileData["games"] = [];

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
          region: "US",
          online: false,
          hours: "—",
          games: owned,
          stores: [
            {
              name: "Steam",
              count: owned.filter((g) => g.source === "Steam").length,
              note: "Library details unavailable",
            },
            {
              name: "PlayStation",
              count: owned.filter((g) => g.source === "PlayStation").length,
              note: "Library details unavailable",
            },
          ],
          activity: [],
        }}
      />
    </AppShell>
  );
}
