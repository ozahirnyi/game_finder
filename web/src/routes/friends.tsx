import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { FormEvent, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Avatar, GameCover } from "@/components/GameCover";
import { Chip, SectionHeader } from "@/components/ui-bits";
import {
  acceptFriendRequest,
  createConversation,
  createFriendRequest,
  createGameInvite,
  createMessage,
  deleteFriend,
  deleteFriendRequest,
  getSocialInviteLink,
  getSteamSocial,
  isAuthenticated,
  listConversations,
  listFriendRequests,
  listFriends,
  listGameInvites,
  listIncomingFriendRequests,
  listMessages,
  respondToGameInvite,
  searchUsers,
  type PublicUser,
} from "@/lib/api";
import { lovableQueryKeys } from "@/lib/lovable-data";
import {
  Check,
  Copy,
  Gamepad2,
  MessageCircle,
  Search,
  UserPlus,
  X,
} from "lucide-react";

export const Route = createFileRoute("/friends")({
  head: () => ({
    meta: [
      { title: "Friends — GameFinder" },
      {
        name: "description",
        content:
          "GameFinder friends, messages, invitations, and Steam friends.",
      },
    ],
  }),
  component: FriendsPage,
});

const socialKeys = {
  friends: ["social", "friends"],
  outgoing: ["social", "requests", "outgoing"],
  incoming: ["social", "requests", "incoming"],
  conversations: ["social", "conversations"],
  invites: ["social", "game-invites"],
} as const;

function steamCover(appId: number, icon: string | null) {
  return icon
    ? `https://media.steampowered.com/steamcommunity/public/images/apps/${appId}/${icon}.jpg`
    : "#18212f";
}

function PlayerAvatar({ user }: { user: PublicUser }) {
  return (
    <Avatar
      from="#314158"
      to="#18212f"
      name={user.display_name}
      imageUrl={user.avatar}
      className="size-11 rounded-full"
    />
  );
}

export function FriendsPage() {
  const signedIn = isAuthenticated();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedConversation, setSelectedConversation] = useState<
    string | null
  >(null);
  const [message, setMessage] = useState("");
  const [invitee, setInvitee] = useState<PublicUser | null>(null);
  const [inviteGame, setInviteGame] = useState("");
  const [copied, setCopied] = useState(false);
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: socialKeys.friends }),
      queryClient.invalidateQueries({ queryKey: socialKeys.outgoing }),
      queryClient.invalidateQueries({ queryKey: socialKeys.incoming }),
      queryClient.invalidateQueries({ queryKey: socialKeys.conversations }),
      queryClient.invalidateQueries({ queryKey: socialKeys.invites }),
    ]);

  const friendsQuery = useQuery({
    queryKey: socialKeys.friends,
    queryFn: listFriends,
    enabled: signedIn,
  });
  const outgoingQuery = useQuery({
    queryKey: socialKeys.outgoing,
    queryFn: listFriendRequests,
    enabled: signedIn,
  });
  const incomingQuery = useQuery({
    queryKey: socialKeys.incoming,
    queryFn: listIncomingFriendRequests,
    enabled: signedIn,
  });
  const conversationsQuery = useQuery({
    queryKey: socialKeys.conversations,
    queryFn: listConversations,
    enabled: signedIn,
  });
  const invitesQuery = useQuery({
    queryKey: socialKeys.invites,
    queryFn: listGameInvites,
    enabled: signedIn,
  });
  const inviteLinkQuery = useQuery({
    queryKey: ["social", "invite-link"],
    queryFn: getSocialInviteLink,
    enabled: signedIn,
  });
  const usersQuery = useQuery({
    queryKey: ["social", "users", search],
    queryFn: () => searchUsers(search),
    enabled: signedIn && search.trim().length >= 2,
  });
  const steamQuery = useQuery({
    queryKey: lovableQueryKeys.steamSocial(12),
    queryFn: () => getSteamSocial(12),
    enabled: signedIn,
  });
  const messagesQuery = useQuery({
    queryKey: ["social", "messages", selectedConversation],
    queryFn: () => listMessages(selectedConversation!),
    enabled: Boolean(selectedConversation) && signedIn,
  });

  const requestFriend = useMutation({
    mutationFn: (userId: string) => createFriendRequest(userId),
    onSuccess: refresh,
  });
  const acceptRequest = useMutation({
    mutationFn: (requestId: string) => acceptFriendRequest(requestId),
    onSuccess: refresh,
  });
  const cancelRequest = useMutation({
    mutationFn: (requestId: string) => deleteFriendRequest(requestId),
    onSuccess: refresh,
  });
  const removeFriend = useMutation({
    mutationFn: (userId: string) => deleteFriend(userId),
    onSuccess: refresh,
  });
  const beginConversation = useMutation({
    mutationFn: (userId: string) => createConversation(userId),
    onSuccess: async (conversation) => {
      await queryClient.invalidateQueries({
        queryKey: socialKeys.conversations,
      });
      setSelectedConversation(conversation.id);
    },
  });
  const sendMessage = useMutation({
    mutationFn: ({
      conversationId,
      body,
    }: {
      conversationId: string;
      body: string;
    }) => createMessage(conversationId, body),
    onSuccess: async () => {
      setMessage("");
      await queryClient.invalidateQueries({
        queryKey: ["social", "messages", selectedConversation],
      });
      await queryClient.invalidateQueries({
        queryKey: socialKeys.conversations,
      });
    },
  });
  const sendInvite = useMutation({
    mutationFn: ({ userId, gameName }: { userId: string; gameName: string }) =>
      createGameInvite(userId, gameName),
    onSuccess: async () => {
      setInvitee(null);
      setInviteGame("");
      await queryClient.invalidateQueries({ queryKey: socialKeys.invites });
    },
  });
  const replyInvite = useMutation({
    mutationFn: ({
      id,
      status,
    }: {
      id: string;
      status: "accepted" | "declined";
    }) => respondToGameInvite(id, status),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: socialKeys.invites }),
  });

  const selected = conversationsQuery.data?.find(
    (conversation) => conversation.id === selectedConversation,
  );
  const steamFriends = steamQuery.data?.friends ?? [];
  const sharedGames = steamFriends
    .flatMap((friend) =>
      friend.common_games.slice(0, 3).map((game) => ({ friend, game })),
    )
    .slice(0, 6);
  const pendingInvites =
    invitesQuery.data?.filter((invite) => invite.status === "pending") ?? [];

  const copyInviteLink = async () => {
    if (!inviteLinkQuery.data?.url) return;
    try {
      await navigator.clipboard.writeText(inviteLinkQuery.data.url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  const submitMessage = (event: FormEvent) => {
    event.preventDefault();
    if (selectedConversation && message.trim())
      sendMessage.mutate({
        conversationId: selectedConversation,
        body: message.trim(),
      });
  };
  const submitInvite = (event: FormEvent) => {
    event.preventDefault();
    if (invitee && inviteGame.trim())
      sendInvite.mutate({ userId: invitee.id, gameName: inviteGame.trim() });
  };

  if (!signedIn)
    return (
      <AppShell>
        <SectionHeader
          title="Friends"
          hint="Sign in to find GameFinder players and use messages."
        />
        <div className="rounded-3xl border border-border bg-surface p-6">
          <p className="text-sm text-muted-foreground">
            Your session is signed out.
          </p>
          <Link
            to="/login"
            className="mt-4 inline-block rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
          >
            Sign in
          </Link>
        </div>
      </AppShell>
    );

  return (
    <AppShell>
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
        <main className="space-y-10 lg:col-span-8">
          <section>
            <SectionHeader
              title="GameFinder friends"
              hint={`${friendsQuery.data?.length ?? 0} confirmed friends`}
              action={
                <button
                  onClick={copyInviteLink}
                  disabled={!inviteLinkQuery.data?.url}
                  className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-bold hover:bg-white/5"
                >
                  <Copy className="size-3.5" />{" "}
                  {copied ? "Invite link copied" : "Copy invite link"}
                </button>
              }
            />
            <div className="mb-4 flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3">
              <Search className="size-4 text-muted-foreground" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search GameFinder players"
                className="flex-1 bg-transparent text-sm outline-none"
              />
            </div>
            {usersQuery.data && (
              <div className="mb-5 space-y-2">
                {usersQuery.data.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3"
                  >
                    <PlayerAvatar user={user} />
                    <div className="min-w-0 flex-1">
                      <p className="font-bold">{user.display_name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {user.bio || "GameFinder player"}
                      </p>
                    </div>
                    <button
                      onClick={() => requestFriend.mutate(user.id)}
                      disabled={requestFriend.isPending}
                      aria-label={`Add ${user.display_name}`}
                      className="rounded-md bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground"
                    >
                      <UserPlus className="mr-1 inline size-3.5" />
                      Add
                    </button>
                  </div>
                ))}
              </div>
            )}
            {usersQuery.isSuccess && usersQuery.data.length === 0 && (
              <p className="mb-5 text-sm text-muted-foreground">
                No registered player matched that name.
              </p>
            )}
            {incomingQuery.data && incomingQuery.data.length > 0 && (
              <div className="mb-5 rounded-2xl border border-border bg-surface p-4">
                <p className="mb-3 text-sm font-bold">Friend requests</p>
                {incomingQuery.data.map((request) => (
                  <div
                    key={request.id}
                    className="flex items-center gap-3 border-t border-border py-3 first:border-t-0 first:pt-0"
                  >
                    <PlayerAvatar user={request.sender} />
                    <p className="flex-1 text-sm">
                      <strong>{request.sender.display_name}</strong>
                      {request.message
                        ? ` — ${request.message}`
                        : " wants to be friends."}
                    </p>
                    <button
                      onClick={() => acceptRequest.mutate(request.id)}
                      className="rounded-md bg-primary px-2 py-1 text-xs font-bold text-primary-foreground"
                    >
                      <Check className="size-3.5" />
                    </button>
                    <button
                      onClick={() => cancelRequest.mutate(request.id)}
                      className="rounded-md border border-border p-1 text-xs"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {outgoingQuery.data && outgoingQuery.data.length > 0 && (
              <p className="mb-4 text-xs text-muted-foreground">
                Pending:{" "}
                {outgoingQuery.data.map((request) => (
                  <button
                    key={request.id}
                    onClick={() => cancelRequest.mutate(request.id)}
                    className="ml-1 underline"
                  >
                    {request.recipient.display_name}
                  </button>
                ))}
              </p>
            )}
            <div className="space-y-3">
              {friendsQuery.isLoading && (
                <p className="text-sm text-muted-foreground">
                  Loading your friends…
                </p>
              )}
              {friendsQuery.isError && (
                <p className="text-sm text-muted-foreground">
                  Your friends could not be loaded right now.
                </p>
              )}
              {friendsQuery.isSuccess && friendsQuery.data.length === 0 && (
                <p className="rounded-2xl border border-border bg-surface p-5 text-sm text-muted-foreground">
                  Find another GameFinder player above to send the first friend
                  request.
                </p>
              )}
              {friendsQuery.data?.map(({ user }) => (
                <div
                  key={user.id}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4"
                >
                  <PlayerAvatar user={user} />
                  <div className="min-w-0 flex-1">
                    <p className="font-bold">{user.display_name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {user.bio || "GameFinder friend"}
                    </p>
                  </div>
                  <button
                    onClick={() => beginConversation.mutate(user.id)}
                    className="rounded-md border border-border bg-secondary px-3 py-1.5 text-xs font-bold"
                  >
                    <MessageCircle className="mr-1 inline size-3.5" />
                    Message
                  </button>
                  <button
                    onClick={() => setInvitee(user)}
                    className="rounded-md bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground"
                  >
                    <Gamepad2 className="mr-1 inline size-3.5" />
                    Invite
                  </button>
                  <button
                    onClick={() => removeFriend.mutate(user.id)}
                    aria-label={"Remove " + user.display_name}
                    className="rounded-md border border-border p-1.5 text-muted-foreground"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </section>

          {invitee && (
            <section className="rounded-2xl border border-primary/30 bg-surface p-5">
              <SectionHeader
                title={`Invite ${invitee.display_name}`}
                hint="This sends a GameFinder invitation; it does not launch Steam."
              />
              <form onSubmit={submitInvite} className="flex flex-wrap gap-3">
                <input
                  value={inviteGame}
                  onChange={(event) => setInviteGame(event.target.value)}
                  placeholder="Game name"
                  className="min-w-56 flex-1 rounded-lg border border-border bg-secondary px-3 py-2 text-sm outline-none"
                />
                <button
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
                  disabled={!inviteGame.trim() || sendInvite.isPending}
                >
                  Send invite
                </button>
                <button
                  type="button"
                  onClick={() => setInvitee(null)}
                  className="rounded-lg border border-border px-4 py-2 text-sm font-bold"
                >
                  Cancel
                </button>
              </form>
            </section>
          )}

          <section className="grid gap-5 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)]">
            <div>
              <SectionHeader
                title="Messages"
                hint={`${conversationsQuery.data?.reduce((total, conversation) => total + conversation.unread_count, 0) ?? 0} unread`}
              />
              <div className="space-y-2">
                {conversationsQuery.data?.length === 0 && (
                  <p className="rounded-xl border border-border bg-surface p-4 text-sm text-muted-foreground">
                    Start a conversation from a confirmed friend.
                  </p>
                )}
                {conversationsQuery.data?.map((conversation) => (
                  <button
                    key={conversation.id}
                    onClick={() => setSelectedConversation(conversation.id)}
                    className={`w-full rounded-xl border p-3 text-left ${selectedConversation === conversation.id ? "border-primary bg-primary/10" : "border-border bg-surface"}`}
                  >
                    <p className="font-bold">
                      {conversation.participant.display_name}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {conversation.last_message || "No messages yet"}
                    </p>
                    {conversation.unread_count > 0 && (
                      <Chip tone="primary">
                        {conversation.unread_count} unread
                      </Chip>
                    )}
                  </button>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-surface p-4">
              {selected ? (
                <>
                  <p className="mb-4 font-bold">
                    {selected.participant.display_name}
                  </p>
                  <div className="max-h-64 space-y-2 overflow-y-auto">
                    {messagesQuery.data?.map((item) => (
                      <p
                        key={item.id}
                        className="rounded-lg bg-secondary px-3 py-2 text-sm"
                      >
                        {item.body}
                      </p>
                    ))}
                    {messagesQuery.isSuccess &&
                      messagesQuery.data.length === 0 && (
                        <p className="text-sm text-muted-foreground">
                          Say hello.
                        </p>
                      )}
                  </div>
                  <form onSubmit={submitMessage} className="mt-4 flex gap-2">
                    <input
                      value={message}
                      onChange={(event) => setMessage(event.target.value)}
                      placeholder="Write a message"
                      className="min-w-0 flex-1 rounded-lg border border-border bg-secondary px-3 py-2 text-sm outline-none"
                    />
                    <button
                      disabled={!message.trim() || sendMessage.isPending}
                      className="rounded-lg bg-primary px-3 py-2 text-sm font-bold text-primary-foreground"
                    >
                      Send
                    </button>
                  </form>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Select a conversation to read or write messages.
                </p>
              )}
            </div>
          </section>

          {pendingInvites.length > 0 && (
            <section>
              <SectionHeader title="Game invitations" />
              <div className="space-y-2">
                {pendingInvites.map((invite) => (
                  <div
                    key={invite.id}
                    className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface p-4"
                  >
                    <p className="flex-1 text-sm">
                      <strong>{invite.sender.display_name}</strong> invited you
                      to play <strong>{invite.game_name}</strong>
                      {invite.note ? ` — ${invite.note}` : ""}
                    </p>
                    <button
                      onClick={() =>
                        replyInvite.mutate({
                          id: invite.id,
                          status: "accepted",
                        })
                      }
                      className="rounded-md bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() =>
                        replyInvite.mutate({
                          id: invite.id,
                          status: "declined",
                        })
                      }
                      className="rounded-md border border-border px-3 py-1.5 text-xs font-bold"
                    >
                      Decline
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}
        </main>

        <aside className="space-y-8 lg:col-span-4">
          <section>
            <SectionHeader
              title="Steam friends"
              hint={
                steamQuery.data?.steam.linked
                  ? `${steamFriends.length} Steam friends`
                  : "Connect Steam to see external friends."
              }
            />
            {steamQuery.data?.steam.linked ? (
              <div className="space-y-3">
                {steamFriends.length === 0 && (
                  <p className="rounded-xl border border-border bg-surface p-4 text-sm text-muted-foreground">
                    Steam returned no friend records.
                  </p>
                )}
                {steamFriends.map((friend) => (
                  <div
                    key={friend.steam_id}
                    className="rounded-xl border border-border bg-surface p-3"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar
                        from="#314158"
                        to="#18212f"
                        name={friend.persona_name ?? friend.steam_id}
                        imageUrl={friend.avatar}
                        className="size-11 rounded-full"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-bold">
                          {friend.persona_name ?? friend.steam_id}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {friend.common_games_count} shared games
                        </p>
                      </div>
                      <a
                        href={`https://steamcommunity.com/profiles/${friend.steam_id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-bold text-primary hover:underline"
                      >
                        Steam profile
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-border bg-surface p-4 text-sm text-muted-foreground">
                Steam is optional.{" "}
                <Link to="/steam" className="font-bold text-primary">
                  Connect Steam
                </Link>{" "}
                to see its friends and common games.
              </div>
            )}
          </section>
          <section>
            <SectionHeader
              title="Play together"
              hint="Common games reported by Steam."
            />
            <div className="grid grid-cols-2 gap-3">
              {sharedGames.map(({ friend, game }) => (
                <article
                  key={`${friend.steam_id}-${game.appid}`}
                  className="overflow-hidden rounded-xl border border-border bg-surface"
                >
                  <GameCover
                    from={steamCover(game.appid, game.img_icon_url)}
                    to="#18212f"
                    title={game.name}
                    compact
                    className="aspect-video w-full"
                  />
                  <div className="p-2">
                    <p className="truncate text-xs font-bold">{game.name}</p>
                    <p className="truncate text-[10px] text-muted-foreground">
                      with {friend.persona_name ?? friend.steam_id}
                    </p>
                  </div>
                </article>
              ))}
              {steamQuery.data?.steam.linked && sharedGames.length === 0 && (
                <p className="col-span-full rounded-xl border border-border bg-surface p-4 text-sm text-muted-foreground">
                  No shared Steam games were returned.
                </p>
              )}
            </div>
          </section>
        </aside>
      </div>
    </AppShell>
  );
}
