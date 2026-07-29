import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { Avatar, GameCover } from "@/components/GameCover";
import { Chip, EmptyState, PresenceDot, SectionHeader } from "@/components/ui-bits";
import { getFriends } from "@/lib/api";
import { friendDisplayName } from "@/lib/friendIdentity";
import { Search, UserPlus, Gamepad2, MessageCircle, Users } from "lucide-react";

export const Route = createFileRoute("/friends/")({
  head: () => ({
    meta: [
      { title: "Friends — Playfinder" },
      {
        name: "description",
        content:
          "Your gaming circle: shared libraries, who's online, and quick invites to play together.",
      },
      { property: "og:title", content: "Friends — Playfinder" },
      {
        property: "og:description",
        content: "See who's online, what you both own, and invite friends to play.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FriendsPage,
});

function FriendsPage() {
  const friendsQuery = useQuery({ queryKey: ["friends"], queryFn: getFriends });
  const friends = (friendsQuery.data ?? []).map(({ user }) => ({
    id: user.id,
    name: friendDisplayName(user),
    handle: friendDisplayName(user),
    avatarFrom: "#7c3aed",
    avatarTo: "#111827",
    avatarUrl: user.avatar ?? undefined,
    online: false,
    lft: false,
    compatibility: undefined as number | undefined,
    sharedGames: undefined as number | undefined,
    activity: undefined as string | undefined,
    genres: [],
    platforms: [],
  }));
  const list = friends;
  const focus = list[0];
  const sharedGames: Array<{ id: string; title: string; coverFrom: string; coverTo: string; coverUrl?: string }> = [];
  const activity: Array<{ id: string; who: string; verb: string; target: string; time: string }> = [];

  return (
    <AppShell>
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
        <div className="space-y-10 lg:col-span-8">
          <div>
            <SectionHeader
              title="Friends"
              hint={`${friends.length} friends · ${friends.filter((f) => f.online).length} online now`}
              action={
                <div className="flex items-center gap-2">
                  <button className="flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground">
                    <UserPlus className="size-3.5" /> Add friend
                  </button>
                </div>
              }
            />
            <div className="mb-6 flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 focus-within:border-primary/60">
              <Search className="size-4 text-muted-foreground" />
              <input
                placeholder="Find players by game, language, platform, play style…"
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>

            {friends.length === 0 ? (
              <EmptyState
                icon={<Users className="size-5" />}
                title="No friends yet"
                description="Add friends to compare libraries and find games you can play together."
                action={
                  <button className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">
                    Add friend
                  </button>
                }
              />
            ) : (
              <div className="stagger space-y-3">
                {list.map((f) => (
                  <Link
                    key={f.id}
                    to="/friends/$friendId"
                    params={{ friendId: f.id }}
                    className="hover-lift grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 rounded-2xl border border-border bg-surface p-4 hover:border-primary/40 sm:grid-cols-[auto_minmax(0,1fr)_auto_auto]"
                  >
                    <div className="relative shrink-0">
                      <Avatar
                        from={f.avatarFrom}
                        to={f.avatarTo}
                        name={f.name}
                        className="size-14 rounded-full"
                      />
                      <span className="absolute -bottom-0.5 -right-0.5">
                        <PresenceDot online={f.online} />
                      </span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-bold">{f.name}</p>
                        <span className="font-mono text-[10px] text-muted-foreground">
                          @{f.handle}
                        </span>
                        {f.lft && <Chip tone="primary">LFG</Chip>}
                      </div>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {f.online ? f.activity : "Offline"}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {f.genres.map((g) => (
                          <Chip key={g}>{g}</Chip>
                        ))}
                        {f.platforms.map((p) => (
                          <Chip key={p} tone="outline">
                            {p}
                          </Chip>
                        ))}
                      </div>
                    </div>
                    <div className="hidden text-right sm:block">
                      <p className="label-mono text-muted-foreground">Compatibility</p>
                      <p className="font-mono text-lg font-black text-primary">
                        {f.compatibility != null ? `${f.compatibility}%` : "—"}
                      </p>
                      <p className="label-mono mt-0.5 text-muted-foreground">
                        {f.sharedGames != null ? `${f.sharedGames} shared` : "Shared: —"}
                      </p>
                    </div>
                    <div className="flex flex-col gap-2" onClick={(e) => e.preventDefault()}>
                      <button className="rounded-md bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground">
                        Invite to play
                      </button>
                      <button className="rounded-md border border-border bg-secondary px-3 py-1.5 text-xs font-bold">
                        Message
                      </button>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div>
            <SectionHeader
              title="Games you can play together"
              hint="Titles owned by you and your friends"
            />
            {sharedGames.length === 0 ? (
              <EmptyState
                icon={<Gamepad2 className="size-5" />}
                title="Nothing shared yet"
                description="Once libraries are connected, shared games will show up here."
              />
            ) : (
              <div className="stagger grid grid-cols-2 gap-4 md:grid-cols-3">
                {sharedGames.map((g) => (
                  <div
                    key={g.id}
                    className="hover-lift overflow-hidden rounded-xl border border-border bg-surface hover:border-primary/40"
                  >
                    <Link to="/games/$gameId" params={{ gameId: g.id }}>
                      <GameCover
                        from={g.coverFrom}
                        to={g.coverTo}
                        title={g.title}
                        image={g.coverUrl}
                        bare
                        className="aspect-video w-full"
                      />
                    </Link>
                    <div className="p-3">
                      <Link
                        to="/games/$gameId"
                        params={{ gameId: g.id }}
                        className="block truncate text-sm font-bold transition-colors hover:text-primary"
                      >
                        {g.title}
                      </Link>
                      <button className="mt-3 flex w-full items-center justify-center gap-2 rounded-md bg-secondary py-1.5 text-xs font-bold">
                        <Gamepad2 className="size-3.5" /> Invite
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right rail */}
        <div className="space-y-8 lg:col-span-4">
          {focus ? (
            <div className="rounded-3xl border border-border bg-surface p-6">
              <Link
                to="/friends/$friendId"
                params={{ friendId: focus.id }}
                className="flex items-center gap-4 transition hover:opacity-80"
              >
                <Avatar
                  from={focus.avatarFrom}
                  to={focus.avatarTo}
                  name={focus.name}
                  className="size-16 rounded-2xl"
                />
                <div>
                  <p className="font-bold">{focus.name}</p>
                  <p className="font-mono text-xs text-muted-foreground">@{focus.handle}</p>
                </div>
              </Link>

              <div className="my-6 grid grid-cols-3 gap-3 border-y border-border py-4 text-center font-mono">
                <div>
                  <p className="label-mono text-muted-foreground">Compat</p>
                  <p className="text-xl font-black text-primary">
                    {focus.compatibility != null ? `${focus.compatibility}%` : "—"}
                  </p>
                </div>
                <div>
                  <p className="label-mono text-muted-foreground">Shared</p>
                  <p className="text-xl font-black">{focus.sharedGames ?? "—"}</p>
                </div>
                <div>
                  <p className="label-mono text-muted-foreground">Wishlist</p>
                  <p className="text-xl font-black">—</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button className="flex-1 rounded-lg bg-primary px-3 py-2 text-sm font-bold text-primary-foreground">
                  Invite to play
                </button>
                <button className="grid size-10 place-items-center rounded-lg border border-border">
                  <MessageCircle className="size-4" />
                </button>
              </div>
            </div>
          ) : (
            <EmptyState
              icon={<Users className="size-5" />}
              title="No friend selected"
              description="Pick a friend to see compatibility details."
            />
          )}

          <div>
            <SectionHeader title="Activity" />
            {activity.length === 0 ? (
              <EmptyState title="No activity" description="Recent activity will appear here." />
            ) : (
              <div className="space-y-4 font-mono text-[11px] leading-relaxed">
                {activity.map((a) => {
                  const f = friends.find((x) => x.id === a.who)!;
                  return (
                    <div key={a.id} className="flex gap-3">
                      <Avatar
                        from={f.avatarFrom}
                        to={f.avatarTo}
                        name={f.name}
                        className="size-7 shrink-0 rounded-full"
                      />
                      <p className="text-muted-foreground">
                        <span className="text-primary">{f.name}</span> {a.verb}{" "}
                        <span className="text-foreground">{a.target}</span>{" "}
                        <span className="text-muted-foreground/60">{a.time}</span>
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
