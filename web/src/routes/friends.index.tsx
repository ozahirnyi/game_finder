import { createFileRoute, Link } from "@tanstack/react-router";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Avatar, GameCover } from "@/components/GameCover";
import { Chip, EmptyState, PresenceDot, SectionHeader } from "@/components/ui-bits";
import { acceptFriendRequest, createFriendRequest, getFriends, getIncomingFriendRequests, getSteamSocial, searchUsers } from "@/lib/api";
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
  const queryClient = useQueryClient();
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [friendSource, setFriendSource] = useState<"playfinder" | "steam">("playfinder");
  const [steamExpanded, setSteamExpanded] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [status, setStatus] = useState("");
  const friendsQuery = useQuery({ queryKey: ["friends"], queryFn: getFriends });
  const steamSocialQuery = useInfiniteQuery({
    queryKey: ["steam-social"],
    queryFn: ({ pageParam }) => getSteamSocial(12, pageParam),
    initialPageParam: 0,
    getNextPageParam: (lastPage, pages) => lastPage.friends_has_more ? pages.reduce((total, page) => total + page.friends.length, 0) : undefined,
    retry: false,
  });
  const incomingQuery = useQuery({ queryKey: ["friend-requests", "incoming"], queryFn: getIncomingFriendRequests });
  const searchQuery = useQuery({
    queryKey: ["user-search", searchTerm],
    queryFn: () => searchUsers(searchTerm),
    enabled: showAddFriend && searchTerm.trim().length >= 2,
  });
  const requestMutation = useMutation({
    mutationFn: (data: { recipient_id: string; message?: string }) => createFriendRequest(data),
    onSuccess: () => {
      setStatus("Request sent");
      setSearchTerm("");
    },
  });
  const acceptMutation = useMutation({
    mutationFn: (id: string) => acceptFriendRequest(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["friends"] });
      queryClient.invalidateQueries({ queryKey: ["friend-requests", "incoming"] });
      setStatus("Friend added");
    },
  });
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
  const steamFriends = (steamSocialQuery.data?.pages.flatMap((page) => page.friends) ?? []).sort((a, b) => b.taste_match_percent - a.taste_match_percent || b.common_games_count - a.common_games_count);
  const visibleSteamFriends = steamExpanded ? steamFriends : steamFriends.slice(0, 12);
  const steamFriendsTotal = steamSocialQuery.data?.pages[0]?.friends_total ?? 0;
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
                  <button onClick={() => setFriendSource("playfinder")} className={`rounded-lg px-3 py-2 text-xs font-bold ${friendSource === "playfinder" ? "bg-primary text-primary-foreground" : "border border-border"}`}>Playfinder friends</button>
                  <button onClick={() => setFriendSource("steam")} className={`rounded-lg px-3 py-2 text-xs font-bold ${friendSource === "steam" ? "bg-primary text-primary-foreground" : "border border-border"}`}>Steam friends</button>
                  {friendSource === "playfinder" && <button onClick={() => setShowAddFriend(true)} className="flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground">
                    <UserPlus className="size-3.5" /> Add friend
                  </button>}
                </div>
              }
            />
            {showAddFriend && (
              <section aria-label="Add friend" className="mb-6 rounded-2xl border border-border bg-surface p-4">
                <label className="grid gap-2 text-sm font-bold">Player name
                  <input aria-label="Player name" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search by display name" className="rounded-lg border border-border bg-background px-3 py-2 font-normal" />
                </label>
                {searchTerm.trim().length >= 2 && !searchQuery.isLoading && searchQuery.data?.length === 0 && <p className="mt-3 text-sm text-muted-foreground">No players found.</p>}
                <div className="mt-3 space-y-2">
                  {searchQuery.data?.map((player) => (
                    <div key={player.id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                      <span className="font-semibold">{friendDisplayName(player)}</span>
                      <button onClick={() => requestMutation.mutate({ recipient_id: player.id })} disabled={requestMutation.isPending} className="rounded-md bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground">Add {friendDisplayName(player)}</button>
                    </div>
                  ))}
                </div>
                {requestMutation.isError && <p role="alert" className="mt-3 text-sm text-destructive">Could not send this request.</p>}
                <button type="button" onClick={() => setShowAddFriend(false)} className="mt-4 text-xs font-bold text-muted-foreground">Close</button>
              </section>
            )}
            {incomingQuery.data?.length ? (
              <section aria-label="Friend requests" className="mb-6 space-y-2 rounded-2xl border border-border bg-surface p-4">
                <h2 className="text-base font-bold">Friend requests</h2>
                {incomingQuery.data.map((request) => (
                  <div key={request.id} className="flex items-center justify-between gap-3">
                    <span className="text-sm">{friendDisplayName(request.sender)}</span>
                    <button onClick={() => acceptMutation.mutate(request.id)} disabled={acceptMutation.isPending} className="rounded-md bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground">Accept {friendDisplayName(request.sender)}</button>
                  </div>
                ))}
              </section>
            ) : null}
            {status && <p role="status" className="mb-4 text-sm font-semibold text-primary">{status}</p>}
            <div className={`mb-6 flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 focus-within:border-primary/60 ${friendSource === "steam" ? "hidden" : ""}`}>
              <Search className="size-4 text-muted-foreground" />
              <input
                aria-label="Find players"
                value={searchTerm}
                onFocus={() => setShowAddFriend(true)}
                onChange={(event) => {
                  setSearchTerm(event.target.value);
                  setShowAddFriend(true);
                }}
                placeholder="Find players by name"
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>

            <section className={friendSource === "steam" ? "mb-8" : "hidden"}>
              <SectionHeader title="Steam friends" hint={steamSocialQuery.data ? `${steamFriendsTotal} friends` : "Connect Steam to compare libraries"} />
              {steamFriends.length > 0 ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {visibleSteamFriends.map((friend) => (
                    <a key={friend.steam_id} href={`https://steamcommunity.com/profiles/${friend.steam_id}`} target="_blank" rel="noreferrer" aria-label={friend.persona_name ?? "Steam friend"} className="hover-lift flex items-center gap-3 rounded-2xl border border-border bg-surface p-4 hover:border-primary/40">
                      <Avatar from="#2563eb" to="#111827" name={friend.persona_name ?? "Steam friend"} image={friend.avatar ?? undefined} className="size-12 rounded-full" />
                      <div className="min-w-0"><p className="truncate font-bold">{friend.persona_name ?? "Steam friend"}</p><p className="mt-1 text-xs text-muted-foreground">{friend.library_public ? `${friend.taste_match_percent}% match · ${friend.common_games_count} shared` : "Library is private"}</p></div>
                    </a>
                  ))}
                </div>
              ) : (
                <EmptyState icon={<Users className="size-5" />} title="No Steam friends available" description={steamSocialQuery.isError ? "Steam friends list is private or unavailable." : "Connect Steam to compare libraries and taste match."} />
              )}
              {(steamSocialQuery.hasNextPage || steamFriends.length > 12) && <button type="button" onClick={() => { if (!steamExpanded) { setSteamExpanded(true); if (steamSocialQuery.hasNextPage) steamSocialQuery.fetchNextPage(); } else if (steamSocialQuery.hasNextPage) steamSocialQuery.fetchNextPage(); else setSteamExpanded(false); }} disabled={steamSocialQuery.isFetchingNextPage} className="mt-4 rounded-lg border border-border px-4 py-2 text-sm font-bold hover:border-primary/50">{steamSocialQuery.isFetchingNextPage ? "Loading…" : steamExpanded && !steamSocialQuery.hasNextPage ? "Show fewer Steam friends" : "Show more Steam friends"}</button>}
            </section>

            {friendSource === "playfinder" && (friends.length === 0 ? (
              <EmptyState
                icon={<Users className="size-5" />}
                title="No friends yet"
                description="Add friends to compare libraries and find games you can play together."
                action={
                  <button onClick={() => setShowAddFriend(true)} className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">
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
                      <button disabled title="Invites are coming soon" className="cursor-not-allowed rounded-md bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground opacity-50">
                        Invite to play
                      </button>
                      <button disabled title="Messaging is coming soon" className="cursor-not-allowed rounded-md border border-border bg-secondary px-3 py-1.5 text-xs font-bold opacity-50">
                        Message
                      </button>
                    </div>
                  </Link>
                ))}
              </div>
            ))}
          </div>

          <div className={friendSource === "playfinder" ? "" : "hidden"}>
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
            <div className="hidden rounded-3xl border border-border bg-surface p-6">
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
                <button disabled title="Invites are coming soon" className="flex-1 cursor-not-allowed rounded-lg bg-primary px-3 py-2 text-sm font-bold text-primary-foreground opacity-50">
                  Invite to play
                </button>
                <button disabled aria-label="Messaging is coming soon" title="Messaging is coming soon" className="grid size-10 cursor-not-allowed place-items-center rounded-lg border border-border opacity-50">
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
