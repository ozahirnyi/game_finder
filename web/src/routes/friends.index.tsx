import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Avatar } from "@/components/GameCover";
import { Chip, EmptyState, SectionHeader } from "@/components/ui-bits";
import {
  acceptFriendRequest,
  ApiError,
  createFriendRequest,
  getConversationMessages,
  getConversations,
  getFriendSocialSummary,
  getGameInvites,
  getSteamSocial,
  respondToGameInvite,
  searchUsers,
} from "@/lib/api";
import { friendDisplayName } from "@/lib/friendIdentity";
import {
  friendsQueryOptions,
  incomingFriendRequestsQueryOptions,
  steamSocialInfiniteQueryOptions,
} from "@/lib/navigationQueries";
import { Search, UserPlus, Gamepad2, MessageCircle, Users } from "lucide-react";

export const Route = createFileRoute("/friends/")({
  head: () => ({
    meta: [
      { title: "Friends — Playfinder" },
      {
        name: "description",
        content: "Your Playfinder friends, shared libraries, and game invitations.",
      },
      { property: "og:title", content: "Friends — Playfinder" },
      {
        property: "og:description",
        content: "Browse friends, compare saved libraries, and invite friends to play.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FriendsPage,
});

function FriendsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [friendSource, setFriendSource] = useState<"playfinder" | "steam">("playfinder");
  const [steamExpanded, setSteamExpanded] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [status, setStatus] = useState("");
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null);
  const friendsQuery = useQuery(friendsQueryOptions());
  const steamSocialQuery = useInfiniteQuery({ ...steamSocialInfiniteQueryOptions(), retry: false });
  const incomingQuery = useQuery(incomingFriendRequestsQueryOptions());
  const gameInvitesQuery = useQuery({
    queryKey: ["game-invites", "incoming"],
    queryFn: () => getGameInvites("incoming"),
  });
  const allGameInvitesQuery = useQuery({
    queryKey: ["game-invites", "all"],
    queryFn: () => getGameInvites("all"),
  });
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
  const respondInviteMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "accepted" | "declined" }) =>
      respondToGameInvite(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["game-invites"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      setStatus("Invite response sent");
    },
  });
  const incomingInvites = (gameInvitesQuery.data ?? []).filter(
    (invite) => invite.status === "pending",
  );
  const friends = (friendsQuery.data ?? []).map(({ user }) => ({
    id: user.id,
    name: friendDisplayName(user),
    handle: friendDisplayName(user),
    avatarFrom: "#7c3aed",
    avatarTo: "#111827",
  }));
  const list = friends;
  const selectedFriend = list.find((friend) => friend.id === selectedFriendId) ?? list[0];
  const selectedId = selectedFriend?.id;
  const selectedSummaryQuery = useQuery({
    queryKey: ["friend-social-summary", selectedId],
    queryFn: () => getFriendSocialSummary(selectedId!),
    enabled: !!selectedId,
  });
  const conversationsQuery = useQuery({
    queryKey: ["conversations"],
    queryFn: getConversations,
  });
  const selectedConversation = conversationsQuery.data?.find(
    (conversation) => conversation.participant.id === selectedId,
  );
  const selectedMessagesQuery = useQuery({
    queryKey: ["conversation-messages", selectedConversation?.id],
    queryFn: () => getConversationMessages(selectedConversation!.id),
    enabled: !!selectedConversation,
  });
  const selectedInvites = (allGameInvitesQuery.data ?? []).filter(
    (invite) => invite.sender.id === selectedId || invite.recipient.id === selectedId,
  );
  const steamFriends = (steamSocialQuery.data?.pages.flatMap((page) => page.friends) ?? []).sort(
    (a, b) =>
      b.taste_match_percent - a.taste_match_percent || b.common_games_count - a.common_games_count,
  );
  const visibleSteamFriends = steamExpanded ? steamFriends : steamFriends.slice(0, 12);
  const steamFriendsTotal = steamSocialQuery.data?.pages[0]?.friends_total ?? 0;
  const steamState =
    steamSocialQuery.error instanceof ApiError
      ? steamSocialQuery.error.status === 409
        ? "disconnected"
        : steamSocialQuery.error.status === 403
          ? "private"
          : "error"
      : null;

  if (friendsQuery.isPending && !friendsQuery.data) {
    return (
      <AppShell>
        <div
          data-testid="friends-loading"
          className="rounded-2xl border border-border bg-surface p-6 text-sm text-muted-foreground"
        >
          Loading your friends…
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
        <div className="space-y-10 lg:col-span-8">
          <div>
            <SectionHeader
              title="Friends"
              hint={`${friends.length} friends`}
              action={
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setFriendSource("playfinder")}
                    className={`rounded-lg px-3 py-2 text-xs font-bold ${friendSource === "playfinder" ? "bg-primary text-primary-foreground" : "border border-border"}`}
                  >
                    Playfinder friends
                  </button>
                  <button
                    onClick={() => setFriendSource("steam")}
                    className={`rounded-lg px-3 py-2 text-xs font-bold ${friendSource === "steam" ? "bg-primary text-primary-foreground" : "border border-border"}`}
                  >
                    Steam friends
                  </button>
                  {friendSource === "playfinder" && (
                    <button
                      onClick={() => setShowAddFriend(true)}
                      className="flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground"
                    >
                      <UserPlus className="size-3.5" /> Add friend
                    </button>
                  )}
                </div>
              }
            />
            {showAddFriend && (
              <section
                aria-label="Add friend"
                className="mb-6 rounded-2xl border border-border bg-surface p-4"
              >
                <label className="grid gap-2 text-sm font-bold">
                  Player name
                  <input
                    aria-label="Player name"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Search by display name"
                    className="rounded-lg border border-border bg-background px-3 py-2 font-normal"
                  />
                </label>
                {searchTerm.trim().length >= 2 &&
                  !searchQuery.isLoading &&
                  searchQuery.data?.length === 0 && (
                    <p className="mt-3 text-sm text-muted-foreground">No players found.</p>
                  )}
                <div className="mt-3 space-y-2">
                  {searchQuery.data?.map((player) => (
                    <div
                      key={player.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
                    >
                      <span className="font-semibold">{friendDisplayName(player)}</span>
                      <button
                        onClick={() => requestMutation.mutate({ recipient_id: player.id })}
                        disabled={requestMutation.isPending}
                        className="rounded-md bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground"
                      >
                        Add {friendDisplayName(player)}
                      </button>
                    </div>
                  ))}
                </div>
                {requestMutation.isError && (
                  <p role="alert" className="mt-3 text-sm text-destructive">
                    Could not send this request.
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => setShowAddFriend(false)}
                  className="mt-4 text-xs font-bold text-muted-foreground"
                >
                  Close
                </button>
              </section>
            )}
            {incomingQuery.data?.length ? (
              <section
                aria-label="Friend requests"
                className="mb-6 space-y-2 rounded-2xl border border-border bg-surface p-4"
              >
                <h2 className="text-base font-bold">Friend requests</h2>
                {incomingQuery.data.map((request) => (
                  <div key={request.id} className="flex items-center justify-between gap-3">
                    <span className="text-sm">{friendDisplayName(request.sender)}</span>
                    <button
                      onClick={() => acceptMutation.mutate(request.id)}
                      disabled={acceptMutation.isPending}
                      className="rounded-md bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground"
                    >
                      Accept {friendDisplayName(request.sender)}
                    </button>
                  </div>
                ))}
              </section>
            ) : null}
            {incomingInvites.length ? (
              <section
                aria-label="Game invites"
                className="mb-6 space-y-2 rounded-2xl border border-border bg-surface p-4"
              >
                <h2 className="text-base font-bold">Game invites</h2>
                {incomingInvites.map((invite) => (
                  <div key={invite.id} className="flex items-center justify-between gap-3">
                    <span className="text-sm">
                      {friendDisplayName(invite.sender)} invited you to play {invite.game_name}
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() =>
                          respondInviteMutation.mutate({ id: invite.id, status: "accepted" })
                        }
                        className="rounded-md bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground"
                      >
                        Accept {invite.game_name}
                      </button>
                      <button
                        onClick={() =>
                          respondInviteMutation.mutate({ id: invite.id, status: "declined" })
                        }
                        className="rounded-md border border-border px-3 py-1.5 text-xs font-bold"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                ))}
              </section>
            ) : null}
            {status && (
              <p role="status" className="mb-4 text-sm font-semibold text-primary">
                {status}
              </p>
            )}
            <div
              className={`mb-6 flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 focus-within:border-primary/60 ${friendSource === "steam" ? "hidden" : ""}`}
            >
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
              <SectionHeader
                title="Steam friends"
                hint={
                  steamSocialQuery.data
                    ? `${steamFriendsTotal} friends`
                    : "Connect Steam to compare libraries"
                }
              />
              {steamFriends.length > 0 ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {visibleSteamFriends.map((friend) => (
                    <a
                      key={friend.steam_id}
                      href={`https://steamcommunity.com/profiles/${friend.steam_id}`}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={friend.persona_name ?? "Steam friend"}
                      className="hover-lift flex items-center gap-3 rounded-2xl border border-border bg-surface p-4 hover:border-primary/40"
                    >
                      <Avatar
                        from="#2563eb"
                        to="#111827"
                        name={friend.persona_name ?? "Steam friend"}
                        image={friend.avatar ?? undefined}
                        className="size-12 rounded-full"
                      />
                      <div className="min-w-0">
                        <p className="truncate font-bold">
                          {friend.persona_name ?? "Steam friend"}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {friend.library_public
                            ? `${friend.taste_match_percent}% match · ${friend.common_games_count} shared`
                            : "Library is private"}
                        </p>
                      </div>
                    </a>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={<Users className="size-5" />}
                  title="No Steam friends available"
                  description={
                    steamState === "disconnected"
                      ? "Steam is not connected. Connect Steam to view friends."
                      : steamState === "private"
                        ? "Steam friends list is private. Make it public in Steam to compare libraries."
                        : steamState === "error"
                          ? "Steam could not be reached. Try again shortly."
                          : "Connect Steam to compare libraries and taste match."
                  }
                />
              )}
              {(steamSocialQuery.hasNextPage || steamFriends.length > 12) && (
                <button
                  type="button"
                  onClick={() => {
                    if (!steamExpanded) {
                      setSteamExpanded(true);
                      if (steamSocialQuery.hasNextPage) steamSocialQuery.fetchNextPage();
                    } else if (steamSocialQuery.hasNextPage) steamSocialQuery.fetchNextPage();
                    else setSteamExpanded(false);
                  }}
                  disabled={steamSocialQuery.isFetchingNextPage}
                  className="mt-4 rounded-lg border border-border px-4 py-2 text-sm font-bold hover:border-primary/50"
                >
                  {steamSocialQuery.isFetchingNextPage
                    ? "Loading…"
                    : steamExpanded && !steamSocialQuery.hasNextPage
                      ? "Show fewer Steam friends"
                      : "Show more Steam friends"}
                </button>
              )}
            </section>

            {friendSource === "playfinder" &&
              (friends.length === 0 ? (
                <EmptyState
                  icon={<Users className="size-5" />}
                  title="No friends yet"
                  description="Add friends to compare libraries and find games you can play together."
                  action={
                    <button
                      onClick={() => setShowAddFriend(true)}
                      className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
                    >
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
                      onClick={() => setSelectedFriendId(f.id)}
                      className="hover-lift grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 rounded-2xl border border-border bg-surface p-4 hover:border-primary/40 sm:grid-cols-[auto_minmax(0,1fr)_auto_auto]"
                    >
                      <div className="relative shrink-0">
                        <Avatar
                          from={f.avatarFrom}
                          to={f.avatarTo}
                          name={f.name}
                          className="size-14 rounded-full"
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate font-bold">{f.name}</p>
                          <span className="font-mono text-[10px] text-muted-foreground">
                            @{f.handle}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2" onClick={(e) => e.preventDefault()}>
                        <button
                          onClick={() =>
                            navigate({
                              to: "/friends/$friendId",
                              params: { friendId: f.id },
                              search: { compose: "invite" },
                            })
                          }
                          className="rounded-md bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground"
                        >
                          Invite to play
                        </button>
                        <button
                          onClick={() =>
                            navigate({
                              to: "/friends/$friendId",
                              params: { friendId: f.id },
                              search: { compose: "message" },
                            })
                          }
                          className="rounded-md border border-border bg-secondary px-3 py-1.5 text-xs font-bold"
                        >
                          Message
                        </button>
                      </div>
                    </Link>
                  ))}
                </div>
              ))}
          </div>
        </div>
        <aside className="space-y-8 lg:col-span-4">
          {selectedFriend ? (
            <>
              <section className="rounded-3xl border border-border bg-surface p-6">
                <p className="label-mono text-muted-foreground">Selected friend</p>
                <Link
                  to="/friends/$friendId"
                  params={{ friendId: selectedFriend.id }}
                  className="mt-3 flex items-center gap-4"
                >
                  <Avatar
                    from={selectedFriend.avatarFrom}
                    to={selectedFriend.avatarTo}
                    name={selectedFriend.name}
                    className="size-16 rounded-2xl"
                  />
                  <div>
                    <p className="font-bold">{selectedFriend.name}</p>
                    <p className="font-mono text-xs text-muted-foreground">
                      @{selectedFriend.handle}
                    </p>
                  </div>
                </Link>
                <div className="my-6 grid grid-cols-3 gap-3 border-y border-border py-4 text-center font-mono">
                  <div>
                    <p className="label-mono text-muted-foreground">Compat</p>
                    <p className="text-xl font-black text-primary">
                      {selectedSummaryQuery.data
                        ? `${selectedSummaryQuery.data.compatibility_percent}%`
                        : "…"}
                    </p>
                  </div>
                  <div>
                    <p className="label-mono text-muted-foreground">Shared</p>
                    <p className="text-xl font-black">
                      {selectedSummaryQuery.data?.shared_games ?? "…"}
                    </p>
                  </div>
                  <div>
                    <p className="label-mono text-muted-foreground">Wishlist</p>
                    <p className="text-xl font-black">
                      {selectedSummaryQuery.data?.wishlist_count ?? "Private"}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() =>
                      navigate({
                        to: "/friends/$friendId",
                        params: { friendId: selectedFriend.id },
                        search: { compose: "invite" },
                      })
                    }
                    className="flex-1 rounded-lg bg-primary px-3 py-2 text-sm font-bold text-primary-foreground"
                  >
                    Invite to play
                  </button>
                  <button
                    aria-label="Quick message"
                    onClick={() =>
                      navigate({
                        to: "/friends/$friendId",
                        params: { friendId: selectedFriend.id },
                        search: { compose: "message" },
                      })
                    }
                    className="grid size-10 place-items-center rounded-lg border border-border"
                  >
                    <MessageCircle className="size-4" />
                  </button>
                </div>
              </section>
              <section>
                <SectionHeader title="Messages" />
                {selectedInvites.length || selectedMessagesQuery.data?.length ? (
                  <div className="space-y-2">
                    {selectedInvites.map((invite) => (
                      <p
                        key={`invite:${invite.id}`}
                        className="rounded-xl border border-border bg-surface p-3 text-sm"
                      >
                        Game invitation: {invite.game_name}
                      </p>
                    ))}
                    {selectedMessagesQuery.data?.map((message) => (
                      <p
                        key={`message:${message.id}`}
                        className="rounded-xl border border-border bg-surface p-3 text-sm"
                      >
                        {message.body}
                      </p>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    title="No messages yet"
                    description="Start a conversation or send a game invitation."
                  />
                )}
              </section>
            </>
          ) : (
            <EmptyState
              icon={<Users className="size-5" />}
              title="No friend selected"
              description="Add a friend to compare libraries."
            />
          )}
        </aside>
      </div>
    </AppShell>
  );
}
