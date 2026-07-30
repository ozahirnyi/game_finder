import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { ProfileView, type ProfileData } from "@/components/ProfileView";
import { getFriendProfile } from "@/lib/api";
import { friendDisplayName } from "@/lib/friendIdentity";
import { ArrowLeft } from "lucide-react";

export function formatFriendPlaytime(games: Array<{ playtime?: number | null; playtime_forever?: number | null }>) {
  const minutes = games.reduce((total, game) => total + Math.max(0, game.playtime ?? game.playtime_forever ?? 0), 0);
  return minutes > 0 ? `${Math.floor(minutes / 60)}h` : "—";
}

export const Route = createFileRoute("/friends/$friendId")({
  validateSearch: (search: Record<string, unknown>): { compose?: "message" | "invite" } => ({
    ...(search.compose === "message" || search.compose === "invite" ? { compose: search.compose } : {}),
  }),
  loader: async ({ params }) => {
    let profile;
    try {
      profile = await getFriendProfile(params.friendId);
    } catch {
      throw notFound();
    }
    const friend = profile.user;
    return {
      friend: {
        id: friend.id,
        name: friendDisplayName(friend),
        handle: friendDisplayName(friend),
        avatarFrom: "#7c3aed",
        avatarTo: "#111827",
        avatarUrl: friend.avatar ?? undefined,
        bio: friend.bio ?? undefined,
        library: profile.library,
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
  const { compose } = Route.useSearch();
  const owned: ProfileData["games"] = friend.library.data.map((game) => ({
    id: game.id,
    title: game.title,
    coverFrom: "#7c3aed",
    coverTo: "#111827",
    coverUrl: game.cover_url ?? undefined,
    playtime: game.playtime_forever,
    source: game.source,
  }));

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
        initialComposer={compose}
        profile={{
          name: friend.name,
          handle: friend.handle,
          avatarFrom: friend.avatarFrom,
          avatarTo: friend.avatarTo,
          avatarUrl: friend.avatarUrl,
          bio: friend.bio,
          friendId: friend.id,
          region: "Global",
          online: false,
          hours: formatFriendPlaytime(owned),
          games: owned,
          stores: [
            {
              name: "Steam",
              count: owned.filter((g) => g.source?.toLowerCase() === "steam").length,
              note: friend.library.status === "hidden" ? "Library is private" : "Synced games",
            },
            {
              name: "PlayStation",
              count: owned.filter((g) => g.source?.toLowerCase() === "psn").length,
              note: friend.library.status === "hidden" ? "Library is private" : "Synced games",
            },
          ],
          activity: [],
        }}
      />
    </AppShell>
  );
}
