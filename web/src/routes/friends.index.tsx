import { createFileRoute, Link, Navigate, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { FriendActions } from "@/components/FriendActions";
import { FriendsSync } from "@/components/FriendsSync";
import { Avatar } from "@/components/GameCover";
import { UserProfileLink } from "@/components/UserProfileLink";
import { Chip, EmptyState, SectionHeader } from "@/components/ui-bits";
import {
  acceptFriendRequest,
  createFriendRequest,
  getConversations,
  getFriendSocialSummary,
  getGameInvites,
  getSharedGames,
  respondToGameInvite,
  markNotificationRead,
  searchUsers,
} from "@/lib/api";
import { friendDisplayName } from "@/lib/friendIdentity";
import { friendsQueryOptions, incomingFriendRequestsQueryOptions } from "@/lib/navigationQueries";
import { Search, UserPlus, Gamepad2, MessageCircle, Users } from "lucide-react";

export const Route = createFileRoute("/friends/")({
  validateSearch: (search: Record<string, unknown>) => ({
    ...(typeof search.request === "string" && search.request ? { request: search.request } : {}),
    ...(typeof search.conversation === "string" && search.conversation
      ? { conversation: search.conversation }
      : {}),
    ...(typeof search.invite === "string" && search.invite ? { invite: search.invite } : {}),
    ...(typeof search.notification === "string" && search.notification
      ? { notification: search.notification }
      : {}),
  }),
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
  const notificationSearch = Route.useSearch();
  const queryClient = useQueryClient();
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [status, setStatus] = useState("");
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null);
  const markedNotificationIds = useRef(new Set<string>());
  const friendsQuery = useQuery(friendsQueryOptions());
  const incomingQuery = useQuery(incomingFriendRequestsQueryOptions());
  const gameInvitesQuery = useQuery({
    queryKey: ["game-invites", "incoming"],
    queryFn: () => getGameInvites("incoming"),
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
    onSuccess: (invite, variables) => {
      queryClient.invalidateQueries({ queryKey: ["game-invites"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      setStatus(
        variables.status === "accepted"
          ? `You accepted the invitation to ${invite.game_name}.`
          : `You declined the invitation to ${invite.game_name}.`,
      );
    },
  });
  const incomingInvites = (gameInvitesQuery.data ?? []).filter(
    (invite) => invite.status === "pending",
  );
  const friends = (friendsQuery.data ?? []).map(({ user }) => ({
    id: user.id,
    publicId: user.public_id,
    name: friendDisplayName(user),
    steamPersonaName: null,
    bio: user.bio ?? null,
    avatarUrl: user.avatar ?? null,
    avatarFrom: "#7c3aed",
    avatarTo: "#111827",
  }));
  const list = friends;
  const conversationsQuery = useQuery({
    queryKey: ["conversations"],
    queryFn: () => getConversations(),
  });
  const matchingConversation = conversationsQuery.data?.find(
    (conversation) => conversation.id === notificationSearch.conversation,
  );
  const selectedFriend =
    list.find((friend) => friend.id === matchingConversation?.participant.id) ??
    list.find((friend) => friend.id === selectedFriendId) ??
    list[0];
  const selectedId = selectedFriend?.id;
  const selectedSummaryQuery = useQuery({
    queryKey: ["friend-social-summary", selectedId],
    queryFn: () => getFriendSocialSummary(selectedId!),
    enabled: !!selectedId,
  });
  const selectedSharedGamesQuery = useQuery({
    queryKey: ["friend-shared-games", selectedId],
    queryFn: () => getSharedGames(selectedId!),
    enabled: !!selectedId,
  });
  const summaryValue = (value: number | null | undefined, fallback = "Private") => {
    if (selectedSummaryQuery.isError) return "Unavailable";
    if (!selectedSummaryQuery.data) return "…";
    return value ?? fallback;
  };
  const matchingRequest = incomingQuery.data?.find(
    (request) => request.id === notificationSearch.request,
  );
  const matchingInvite = (gameInvitesQuery.data ?? []).find(
    (invite) => invite.id === notificationSearch.invite,
  );
  const hasNotificationTarget = Boolean(matchingRequest || matchingInvite || matchingConversation);
  useEffect(() => {
    if (
      notificationSearch.notification &&
      hasNotificationTarget &&
      !markedNotificationIds.current.has(notificationSearch.notification)
    ) {
      markedNotificationIds.current.add(notificationSearch.notification);
      void markNotificationRead(notificationSearch.notification);
    }
  }, [hasNotificationTarget, notificationSearch.notification]);
  const notificationUnavailable =
    Boolean(
      notificationSearch.request || notificationSearch.invite || notificationSearch.conversation,
    ) &&
    !hasNotificationTarget &&
    (incomingQuery.isError ||
      gameInvitesQuery.isError ||
      conversationsQuery.isError ||
      (incomingQuery.isSuccess && gameInvitesQuery.isSuccess && conversationsQuery.isSuccess));
  if (notificationSearch.conversation)
    return (
      <Navigate
        to="/messages/$conversationId"
        params={{ conversationId: notificationSearch.conversation }}
        replace
      />
    );

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
      <FriendsSync />
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
        <div className="space-y-10 lg:col-span-8">
          <div>
            <SectionHeader
              title="Friends"
              hint={`${friends.length} friends`}
              action={
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowAddFriend(true)}
                    className="flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground"
                  >
                    <UserPlus className="size-3.5" /> Add friend
                  </button>
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
                      <UserProfileLink publicId={player.public_id} className="font-semibold">
                        {friendDisplayName(player)}
                      </UserProfileLink>
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
                  <div
                    key={request.id}
                    data-testid={`notification-request-${request.id}`}
                    data-notification-target={matchingRequest?.id === request.id || undefined}
                    className="flex items-center justify-between gap-3"
                  >
                    <UserProfileLink publicId={request.sender.public_id} className="text-sm">
                      {friendDisplayName(request.sender)}
                    </UserProfileLink>
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
            {notificationUnavailable && (
              <p role="status" aria-live="polite" className="mb-4 text-sm text-muted-foreground">
                This notification action is no longer available.
              </p>
            )}
            {incomingInvites.length ? (
              <section
                aria-label="Game invites"
                className="mb-6 space-y-2 rounded-2xl border border-border bg-surface p-4"
              >
                <h2 className="text-base font-bold">Game invites</h2>
                {incomingInvites.map((invite) => (
                  <div
                    key={invite.id}
                    data-testid={`notification-invite-${invite.id}`}
                    data-notification-target={matchingInvite?.id === invite.id || undefined}
                    className="flex items-center justify-between gap-3"
                  >
                    <span className="text-sm">
                      <UserProfileLink publicId={invite.sender.public_id}>
                        {friendDisplayName(invite.sender)}
                      </UserProfileLink>{" "}
                      invited you to play {invite.game_name}
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
            <div className="mb-6 flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 focus-within:border-primary/60">
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

            {friends.length === 0 ? (
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
                  <div
                    key={f.id}
                    className="hover-lift grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-2xl border border-border bg-surface p-4 hover:border-primary/40"
                  >
                    <button
                      type="button"
                      aria-label={`Select ${f.name}`}
                      aria-pressed={selectedId === f.id}
                      onClick={() => setSelectedFriendId(f.id)}
                      onDoubleClick={() =>
                        navigate({
                          to: "/users/$publicId",
                          params: { publicId: f.publicId },
                        })
                      }
                      className="flex min-w-0 items-center gap-4 text-left"
                    >
                      <div className="relative shrink-0">
                        <Avatar
                          from={f.avatarFrom}
                          to={f.avatarTo}
                          name={f.name}
                          image={f.avatarUrl ?? undefined}
                          className="size-14 rounded-full"
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate font-bold">{f.name}</span>
                        </div>
                      </div>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <aside className="space-y-8 lg:col-span-4">
          {selectedFriend ? (
            <>
              <section className="rounded-3xl border border-border bg-surface p-6">
                <p className="label-mono text-muted-foreground">Selected friend</p>
                <UserProfileLink
                  publicId={selectedFriend.publicId}
                  aria-label="Open selected friend's profile"
                  className="mt-3 flex items-center gap-4"
                >
                  <Avatar
                    from={selectedFriend.avatarFrom}
                    to={selectedFriend.avatarTo}
                    name={selectedFriend.name}
                    image={selectedFriend.avatarUrl ?? undefined}
                    className="size-16 rounded-2xl"
                  />
                  <div>
                    <p className="font-bold">{selectedFriend.name}</p>
                  </div>
                </UserProfileLink>
                {selectedFriend.bio && (
                  <p className="mt-4 text-sm text-muted-foreground">{selectedFriend.bio}</p>
                )}
                <div className="my-6 grid grid-cols-3 gap-3 border-y border-border py-4 text-center font-mono">
                  <div>
                    <p className="label-mono text-muted-foreground">Compatibility</p>
                    <p className="text-xl font-black text-primary">
                      {selectedSummaryQuery.data
                        ? `${selectedSummaryQuery.data.compatibility_percent}%`
                        : summaryValue(undefined)}
                    </p>
                  </div>
                  <div>
                    <p className="label-mono text-muted-foreground">Shared games</p>
                    <p className="text-xl font-black">
                      {summaryValue(selectedSummaryQuery.data?.shared_games)}
                    </p>
                  </div>
                  <div>
                    <p className="label-mono text-muted-foreground">Wishlist</p>
                    <p className="text-xl font-black">
                      {summaryValue(selectedSummaryQuery.data?.wishlist_count)}
                    </p>
                  </div>
                </div>
                <section aria-label="Shared games" className="border-t border-border pt-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="label-mono text-muted-foreground">Shared games</p>
                    {selectedSharedGamesQuery.data?.status === "ready" && (
                      <span className="text-xs text-muted-foreground">
                        {selectedSharedGamesQuery.data.data.length} found
                      </span>
                    )}
                  </div>
                  {selectedSharedGamesQuery.isPending && (
                    <p className="mt-2 text-sm text-muted-foreground">Loading shared games…</p>
                  )}
                  {selectedSharedGamesQuery.isError && (
                    <p className="mt-2 text-sm text-muted-foreground">Shared games unavailable.</p>
                  )}
                  {selectedSharedGamesQuery.data?.status === "ready" && (
                    <ul className="mt-2 space-y-1 text-sm">
                      {selectedSharedGamesQuery.data.data.slice(0, 5).map((game) => (
                        <li key={`${game.source}:${game.external_id}`} className="truncate">
                          {game.title}
                        </li>
                      ))}
                    </ul>
                  )}
                  {selectedSharedGamesQuery.data &&
                    selectedSharedGamesQuery.data.status !== "ready" && (
                      <p className="mt-2 text-sm text-muted-foreground">
                        {selectedSharedGamesQuery.data.message ?? "No shared games yet."}
                      </p>
                    )}
                </section>
                <div className="flex gap-2">
                  <button
                    onClick={() =>
                      navigate({
                        to: "/users/$publicId",
                        params: { publicId: selectedFriend.publicId },
                        search: { compose: "invite" },
                      })
                    }
                    className="flex-1 rounded-lg bg-primary px-3 py-2 text-sm font-bold text-primary-foreground"
                  >
                    Invite to play
                  </button>
                  <Link
                    to="/messages"
                    search={{ friend: selectedFriend.id }}
                    aria-label="Open chat"
                    className="flex-1 rounded-lg border border-border px-3 py-2 text-center text-sm font-bold"
                  >
                    Message
                  </Link>
                </div>
                <FriendActions
                  userId={selectedFriend.id}
                  name={selectedFriend.name}
                  isFriend
                  compact
                />
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
