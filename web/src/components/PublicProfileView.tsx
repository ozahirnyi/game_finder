import type { ReactNode } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Avatar, GameCover } from "@/components/GameCover";
import { EmptyState, Panel, SectionHeader } from "@/components/ui-bits";
import { createSocialFriendRequest, type PublicDataBlock, type PublicProfile } from "@/lib/api";

const coverColors = ["#7c3aed", "#0f766e", "#b45309", "#be123c"];

function CompactState({ title, description }: { title: string; description: string }) {
  return <EmptyState title={title} description={description} className="border-0 bg-transparent px-0 py-6" />;
}

function PublicSection<T>({
  title,
  block,
  children,
}: {
  title: string;
  block: PublicDataBlock<T>;
  children: (data: T) => ReactNode;
}) {
  return (
    <Panel className="p-6" testId={`public-profile-${title.toLowerCase()}`}>
      <SectionHeader title={title} />
      {block.status === "hidden" ? (
        <CompactState title={title} description="This section is private." />
      ) : block.status === "empty" ? (
        <CompactState title={title} description={block.message ?? "Nothing to show yet."} />
      ) : (
        children(block.data)
      )}
    </Panel>
  );
}

function CollectionGames({ games }: { games: PublicProfile["favorites"]["data"] }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {games.map((game, index) => (
        <Link
          key={game.id}
          to="/games/$gameId"
          params={{ gameId: String(game.catalog_game_id) }}
          search={{ title: game.title }}
          className="group flex min-w-0 items-center gap-3 rounded-xl border border-border bg-background/35 p-3 transition-colors hover:border-primary/50"
        >
          <GameCover
            from={coverColors[index % coverColors.length]}
            to="#171717"
            title={game.title}
            image={game.cover_url ?? undefined}
            compact
            bare
            className="h-14 w-10 shrink-0 rounded-lg"
          />
          <span className="truncate text-sm font-semibold group-hover:text-primary">{game.title}</span>
        </Link>
      ))}
    </div>
  );
}

export function PublicProfileView({
  profile,
  isAuthenticated,
}: {
  profile: PublicProfile;
  isAuthenticated: boolean;
}) {
  const friendRequest = useMutation({
    mutationFn: () => createSocialFriendRequest(profile.public_id),
  });

  return (
    <div className="space-y-5">
      <Panel className="ember-glow grain flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <Avatar
            from="#7c3aed"
            to="#0f766e"
            name={profile.nickname}
            image={profile.avatar ?? undefined}
            className="size-16 shrink-0 rounded-2xl"
          />
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold tracking-[-0.02em]">{profile.nickname}</h1>
            <p className="mt-1 text-sm text-muted-foreground">PlayFinder profile</p>
          </div>
        </div>
        {profile.relationship === "self" && (
          <a className="rounded-xl border border-border px-4 py-2 text-sm font-semibold hover:border-primary/50" href="/account">
            Profile settings
          </a>
        )}
      </Panel>

      <PublicSection title="Library" block={profile.library}>
        {(games) => (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {games.map((game, index) => {
              const content = (
                <>
                  <GameCover
                    from={coverColors[index % coverColors.length]}
                    to="#171717"
                    title={game.title}
                    image={game.cover_url ?? undefined}
                    compact
                    bare
                    className="h-14 w-10 shrink-0 rounded-lg"
                  />
                  <span className="truncate text-sm font-semibold">{game.title}</span>
                </>
              );
              return game.detail_game_id ? (
                <Link
                  key={game.id}
                  to="/games/$gameId"
                  params={{ gameId: game.detail_game_id }}
                  search={{ title: game.title }}
                  className="group flex min-w-0 items-center gap-3 rounded-xl border border-border bg-background/35 p-3 transition-colors hover:border-primary/50"
                >
                  {content}
                </Link>
              ) : (
                <div key={game.id} className="flex min-w-0 items-center gap-3 rounded-xl border border-border bg-background/35 p-3">
                  {content}
                </div>
              );
            })}
          </div>
        )}
      </PublicSection>

      <PublicSection title="Favorites" block={profile.favorites}>
        {(games) => <CollectionGames games={games} />}
      </PublicSection>
      <PublicSection title="Wishlist" block={profile.wishlist}>
        {(games) => <CollectionGames games={games} />}
      </PublicSection>
      <PublicSection title="Steam" block={profile.steam}>
        {(steam) =>
          steam?.linked ? (
            <div className="flex items-center gap-3 rounded-xl border border-border bg-background/35 p-3">
              <Avatar
                from="#1b3f75"
                to="#0f172a"
                name={steam.persona_name ?? "Steam"}
                image={steam.avatar ?? undefined}
                className="size-10 shrink-0 rounded-xl"
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{steam.persona_name ?? "Steam connected"}</p>
                {steam.profile_url && (
                  <a className="text-sm text-primary hover:underline" href={steam.profile_url} target="_blank" rel="noreferrer">
                    Open Steam profile
                  </a>
                )}
              </div>
            </div>
          ) : (
            <CompactState title="Steam" description="Steam is not connected." />
          )
        }
      </PublicSection>

      {isAuthenticated && profile.relationship === "none" && (
        <button
          type="button"
          disabled={friendRequest.isPending}
          onClick={() => friendRequest.mutate()}
          className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
        >
          {friendRequest.isPending ? "Sending…" : "Add friend"}
        </button>
      )}
      {friendRequest.isError && <p role="alert">Could not send friend request.</p>}
    </div>
  );
}
