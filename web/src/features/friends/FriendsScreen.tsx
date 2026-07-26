import { type FormEvent, useCallback, useEffect, useState } from "react";
import {
  ApiError,
  type SocialCommonGame,
  type SocialMe,
  type SocialPlayer,
  type SocialRequest,
  type SteamFriend,
  acceptFriendRequest,
  cancelFriendRequest,
  createFriendRequest,
  declineFriendRequest,
  getSocialFriendCommonGames,
  getSocialMe,
  getSocialPlayers,
  getSteamSocial,
  updateSocialMe,
} from "@/lib/api";
import { useAuthState } from "@/hooks/useAuthState";

const steamPageSize = 12;
const cardClass = "rounded-2xl border border-border bg-surface p-5";
const primaryButtonClass =
  "rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground disabled:opacity-50";
const secondaryButtonClass =
  "rounded-lg border border-border bg-secondary px-3 py-2 text-xs font-bold disabled:opacity-50";

function messageFor(reason: unknown, fallback: string) {
  return reason instanceof Error ? reason.message : fallback;
}

function mergeById<T>(current: T[], incoming: T[], id: (item: T) => string) {
  const merged = new Map(current.map((item) => [id(item), item]));
  for (const item of incoming) merged.set(id(item), item);
  return [...merged.values()];
}

function messageHref(friendId: string, game = "") {
  const path = `/friends/${encodeURIComponent(friendId)}/messages`;
  if (!game) return path;
  return `${path}?draft=${encodeURIComponent(`Let's play ${game}!`)}`;
}

async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Fall back for browsers that expose Clipboard API but reject its use.
    }
  }

  const input = document.createElement("textarea");
  input.value = text;
  input.setAttribute("readonly", "");
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.appendChild(input);
  input.select();
  try {
    if (!document.execCommand?.("copy")) throw new Error("Copy failed");
  } finally {
    input.remove();
  }
}

function Avatar({
  avatar,
  nickname,
}: {
  avatar: string | null;
  nickname: string;
}) {
  if (avatar) {
    return (
      <img
        alt={`${nickname}'s avatar`}
        className="size-12 rounded-full object-cover"
        height={48}
        src={avatar}
        width={48}
      />
    );
  }
  return (
    <span
      aria-label={`${nickname}'s avatar`}
      className="grid size-12 shrink-0 place-items-center rounded-full bg-secondary font-bold text-primary"
      role="img"
    >
      {nickname.slice(0, 2).toUpperCase()}
    </span>
  );
}

export function FriendsScreen() {
  const authenticated = useAuthState();
  const [social, setSocial] = useState<SocialMe | null>(null);
  const [socialLoading, setSocialLoading] = useState(authenticated);
  const [socialError, setSocialError] = useState("");
  const [nickname, setNickname] = useState("");
  const [nicknameSaving, setNicknameSaving] = useState(false);
  const [relationshipBusy, setRelationshipBusy] = useState("");

  const [query, setQuery] = useState("");
  const [activePlayerQuery, setActivePlayerQuery] = useState("");
  const [players, setPlayers] = useState<SocialPlayer[]>([]);
  const [playerCursor, setPlayerCursor] = useState<string | null>(null);
  const [playersLoading, setPlayersLoading] = useState(false);
  const [playersLoadingMore, setPlayersLoadingMore] = useState(false);
  const [playersError, setPlayersError] = useState("");

  const [steamFriends, setSteamFriends] = useState<SteamFriend[]>([]);
  const [steamTotal, setSteamTotal] = useState(0);
  const [steamHasMore, setSteamHasMore] = useState(false);
  const [steamOffset, setSteamOffset] = useState(0);
  const [steamLoading, setSteamLoading] = useState(authenticated);
  const [steamLoadingMore, setSteamLoadingMore] = useState(false);
  const [steamError, setSteamError] = useState("");
  const [steamNotLinked, setSteamNotLinked] = useState(false);
  const [selectedGames, setSelectedGames] = useState<Record<string, string>>(
    {},
  );
  const [friendGames, setFriendGames] = useState<
    Record<
      string,
      { games: SocialCommonGame[]; loading: boolean; error: string }
    >
  >({});
  const [copyStatus, setCopyStatus] = useState("");

  const refreshSocial = useCallback(async () => {
    const result = await getSocialMe();
    setSocial(result);
    setNickname(result.nickname ?? "");
    setSocialError("");
    return result;
  }, []);

  const loadFirstSteamPage = useCallback(async () => {
    setSteamLoading(true);
    setSteamError("");
    setSteamNotLinked(false);
    try {
      const page = await getSteamSocial(steamPageSize, 0);
      setSteamFriends(mergeById([], page.friends, (item) => item.steam_id));
      setSteamTotal(page.friends_total);
      setSteamHasMore(page.friends_has_more);
      setSteamOffset(page.friends.length);
    } catch (reason) {
      setSteamNotLinked(reason instanceof ApiError && reason.status === 409);
      setSteamError(messageFor(reason, "Could not load Steam friends."));
    } finally {
      setSteamLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authenticated) return;
    let active = true;
    setSocialLoading(true);
    getSocialMe()
      .then((result) => {
        if (!active) return;
        setSocial(result);
        setNickname(result.nickname ?? "");
        setSocialError("");
      })
      .catch((reason) => {
        if (active)
          setSocialError(
            messageFor(reason, "Could not load PlayFinder friends."),
          );
      })
      .finally(() => {
        if (active) setSocialLoading(false);
      });
    void loadFirstSteamPage();
    return () => {
      active = false;
    };
  }, [authenticated, loadFirstSteamPage]);

  useEffect(() => {
    if (!social?.friends.length) {
      setFriendGames({});
      return;
    }
    let active = true;
    setFriendGames(
      Object.fromEntries(
        social.friends.map((friend) => [
          friend.id,
          { games: [], loading: true, error: "" },
        ]),
      ),
    );
    void Promise.all(
      social.friends.map(async (friend) => {
        try {
          const result = await getSocialFriendCommonGames(friend.id);
          return [
            friend.id,
            { games: result.games, loading: false, error: "" },
          ] as const;
        } catch (reason) {
          return [
            friend.id,
            {
              games: [],
              loading: false,
              error: messageFor(reason, "Could not verify shared Steam games."),
            },
          ] as const;
        }
      }),
    ).then((entries) => {
      if (active) setFriendGames(Object.fromEntries(entries));
    });
    return () => {
      active = false;
    };
  }, [social?.friends]);

  if (!authenticated) {
    return (
      <article className={cardClass}>
        <h1 className="text-2xl font-bold">Sign in to see friends</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your PlayFinder friends, requests, messages, and Steam circle are
          private.
        </p>
        <a
          className={`${primaryButtonClass} mt-5 inline-flex`}
          href="/login?returnTo=%2Ffriends"
        >
          Sign in
        </a>
      </article>
    );
  }

  async function saveNickname(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextNickname = nickname.trim();
    if (!nextNickname || nicknameSaving) return;
    setNicknameSaving(true);
    setSocialError("");
    try {
      const updated = await updateSocialMe(nextNickname);
      setSocial(updated);
      setNickname(updated.nickname ?? "");
    } catch (reason) {
      setSocialError(messageFor(reason, "Could not save your nickname."));
    } finally {
      setNicknameSaving(false);
    }
  }

  async function respondToIncoming(request: SocialRequest, accept: boolean) {
    if (relationshipBusy) return;
    setRelationshipBusy(request.id);
    setSocialError("");
    try {
      if (accept) await acceptFriendRequest(request.id);
      else await declineFriendRequest(request.id);
      await refreshSocial();
    } catch (reason) {
      setSocialError(messageFor(reason, "Could not update this request."));
    } finally {
      setRelationshipBusy("");
    }
  }

  async function cancelOutgoing(request: SocialRequest) {
    if (relationshipBusy) return;
    setRelationshipBusy(request.id);
    setSocialError("");
    try {
      await cancelFriendRequest(request.id);
      await refreshSocial();
    } catch (reason) {
      setSocialError(messageFor(reason, "Could not cancel this request."));
    } finally {
      setRelationshipBusy("");
    }
  }

  async function searchPlayers(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const searchQuery = query.trim();
    setPlayersLoading(true);
    setPlayersError("");
    setPlayerCursor(null);
    try {
      const page = await getSocialPlayers(searchQuery);
      setPlayers(mergeById([], page.players, (player) => player.public_id));
      setPlayerCursor(page.next_cursor);
      setActivePlayerQuery(searchQuery);
    } catch (reason) {
      setPlayersError(messageFor(reason, "Could not search players."));
    } finally {
      setPlayersLoading(false);
    }
  }

  async function loadMorePlayers() {
    if (!playerCursor || playersLoadingMore) return;
    setPlayersLoadingMore(true);
    setPlayersError("");
    try {
      const page = await getSocialPlayers(activePlayerQuery, playerCursor);
      setPlayers((current) =>
        mergeById(current, page.players, (player) => player.public_id),
      );
      setPlayerCursor(page.next_cursor);
    } catch (reason) {
      setPlayersError(messageFor(reason, "Could not load more players."));
    } finally {
      setPlayersLoadingMore(false);
    }
  }

  async function addPlayer(player: SocialPlayer) {
    if (relationshipBusy) return;
    setRelationshipBusy(player.public_id);
    setPlayersError("");
    try {
      const request = await createFriendRequest(player.public_id);
      setSocial((current) =>
        current
          ? {
              ...current,
              outgoing_requests: mergeById(
                current.outgoing_requests,
                [request],
                (item) => item.id,
              ),
            }
          : current,
      );
    } catch (reason) {
      setPlayersError(messageFor(reason, "Could not send this request."));
    } finally {
      setRelationshipBusy("");
    }
  }

  async function loadMoreSteam() {
    if (steamLoadingMore || !steamHasMore) return;
    setSteamLoadingMore(true);
    setSteamError("");
    try {
      const page = await getSteamSocial(steamPageSize, steamOffset);
      setSteamFriends((current) =>
        mergeById(current, page.friends, (item) => item.steam_id),
      );
      setSteamTotal(page.friends_total);
      setSteamHasMore(page.friends_has_more);
      setSteamOffset((current) => current + page.friends.length);
    } catch (reason) {
      setSteamError(messageFor(reason, "Could not load more Steam friends."));
    } finally {
      setSteamLoadingMore(false);
    }
  }

  async function copyInviteLink() {
    if (!social) return;
    setCopyStatus("");
    const link = `${window.location.origin}/users/${encodeURIComponent(social.public_id)}`;
    try {
      await copyText(link);
      setCopyStatus("Invite link copied");
    } catch {
      setCopyStatus("Could not copy the invite link");
    }
  }

  if (socialLoading) {
    return (
      <p role="status" className="text-sm text-muted-foreground">
        Loading your friends…
      </p>
    );
  }

  if (!social) {
    return (
      <article className={cardClass}>
        <h1 className="text-2xl font-bold">Friends are unavailable</h1>
        <p role="alert" className="mt-2 text-sm text-destructive">
          {socialError || "Could not load your social profile."}
        </p>
        <button
          className={`${primaryButtonClass} mt-4`}
          onClick={() => {
            setSocialLoading(true);
            void refreshSocial().finally(() => setSocialLoading(false));
          }}
          type="button"
        >
          Retry
        </button>
      </article>
    );
  }

  if (!social.nickname) {
    return (
      <article className={cardClass}>
        <h1 className="text-2xl font-bold">Choose your public nickname</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Other PlayFinder players will find you by this unique name.
        </p>
        <form
          className="mt-5 space-y-3"
          onSubmit={(event) => void saveNickname(event)}
        >
          <label className="block text-sm font-bold" htmlFor="social-nickname">
            Public nickname
          </label>
          <input
            autoComplete="nickname"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            id="social-nickname"
            maxLength={40}
            onChange={(event) => setNickname(event.target.value)}
            required
            value={nickname}
          />
          <button
            className={primaryButtonClass}
            disabled={nicknameSaving || !nickname.trim()}
            type="submit"
          >
            {nicknameSaving ? "Saving…" : "Save nickname"}
          </button>
        </form>
        {socialError ? (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {socialError}
          </p>
        ) : null}
      </article>
    );
  }

  return (
    <div className="space-y-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-primary">
            PlayFinder social
          </p>
          <h1 className="mt-2 text-4xl font-extrabold tracking-tight">
            Friends
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Find players, manage requests, and continue private conversations.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <button
            className={primaryButtonClass}
            onClick={() => void copyInviteLink()}
            type="button"
          >
            Copy invite link
          </button>
          {copyStatus ? (
            <p
              className={
                copyStatus === "Invite link copied"
                  ? "text-xs text-primary"
                  : "text-xs text-destructive"
              }
              role="status"
            >
              {copyStatus}
            </p>
          ) : null}
        </div>
      </header>

      {socialError ? (
        <p role="alert" className="text-sm text-destructive">
          {socialError}
        </p>
      ) : null}

      <section aria-labelledby="my-friends-heading" className="space-y-4">
        <div>
          <h2 className="text-2xl font-bold" id="my-friends-heading">
            My friends
          </h2>
          <p className="text-sm text-muted-foreground">
            {social.friends.length} confirmed PlayFinder friends
          </p>
        </div>
        {social.friends.length ? (
          <div className="grid gap-4 md:grid-cols-2">
            {social.friends.map((friend) => (
              <FriendCard
                friend={friend}
                games={friendGames[friend.id]?.games ?? []}
                gamesError={friendGames[friend.id]?.error ?? ""}
                gamesLoading={friendGames[friend.id]?.loading ?? true}
                key={friend.id}
                onGameChange={(game) =>
                  setSelectedGames((current) => ({
                    ...current,
                    [friend.id]: game,
                  }))
                }
                selectedGame={selectedGames[friend.id] ?? ""}
              />
            ))}
          </div>
        ) : (
          <p className={cardClass}>
            No confirmed friends yet. Search for someone below.
          </p>
        )}
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <RequestList
          busyId={relationshipBusy}
          onAccept={(request) => void respondToIncoming(request, true)}
          onDecline={(request) => void respondToIncoming(request, false)}
          title="Incoming requests"
          requests={social.incoming_requests}
        />
        <OutgoingList
          busyId={relationshipBusy}
          onCancel={(request) => void cancelOutgoing(request)}
          requests={social.outgoing_requests}
        />
      </div>

      <section aria-labelledby="find-players-heading" className="space-y-4">
        <div>
          <h2 className="text-2xl font-bold" id="find-players-heading">
            Find PlayFinder players
          </h2>
          <p className="text-sm text-muted-foreground">
            Search by a player&apos;s public nickname.
          </p>
        </div>
        <form
          className="flex flex-col gap-3 sm:flex-row"
          onSubmit={(event) => void searchPlayers(event)}
        >
          <label className="sr-only" htmlFor="player-search">
            Find PlayFinder players
          </label>
          <input
            className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-4 py-3 text-sm"
            id="player-search"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search nickname"
            value={query}
          />
          <button
            className={primaryButtonClass}
            disabled={playersLoading}
            type="submit"
          >
            {playersLoading ? "Searching…" : "Search players"}
          </button>
        </form>
        {playersError ? (
          <p role="alert" className="text-sm text-destructive">
            {playersError}
          </p>
        ) : null}
        {players.length ? (
          <>
            <div className="grid gap-3 md:grid-cols-2">
              {players.map((player) => (
                <PlayerCard
                  busyId={relationshipBusy}
                  key={player.public_id}
                  onAccept={(request) => void respondToIncoming(request, true)}
                  onAdd={() => void addPlayer(player)}
                  onCancel={(request) => void cancelOutgoing(request)}
                  onDecline={(request) =>
                    void respondToIncoming(request, false)
                  }
                  player={player}
                  social={social}
                />
              ))}
            </div>
            {playerCursor ? (
              <button
                className={secondaryButtonClass}
                disabled={playersLoadingMore}
                onClick={() => void loadMorePlayers()}
                type="button"
              >
                {playersLoadingMore ? "Loading more..." : "Show more players"}
              </button>
            ) : null}
          </>
        ) : null}
      </section>

      <section aria-labelledby="steam-friends-heading" className="space-y-4">
        <div>
          <h2 className="text-2xl font-bold" id="steam-friends-heading">
            Steam friends
          </h2>
          <p className="text-sm text-muted-foreground">
            {steamTotal} Steam friends
          </p>
        </div>
        {steamLoading ? (
          <p role="status" className="text-sm text-muted-foreground">
            Loading Steam friends…
          </p>
        ) : steamNotLinked ? (
          <div className={cardClass}>
            <p className="font-bold">Connect Steam to see Steam friends</p>
            <a
              className={`${primaryButtonClass} mt-4 inline-flex`}
              href="/steam"
            >
              Connect Steam
            </a>
          </div>
        ) : (
          <>
            {steamError ? (
              <p role="alert" className="text-sm text-destructive">
                {steamError}
              </p>
            ) : null}
            {steamFriends.length ? (
              <div className="grid gap-3 md:grid-cols-2">
                {steamFriends.map((friend) => (
                  <SteamFriendCard friend={friend} key={friend.steam_id} />
                ))}
              </div>
            ) : (
              <p className={cardClass}>No Steam friends were returned.</p>
            )}
            {steamHasMore ? (
              <button
                className={secondaryButtonClass}
                disabled={steamLoadingMore}
                onClick={() => void loadMoreSteam()}
                type="button"
              >
                {steamLoadingMore ? "Loading more…" : "Show more Steam friends"}
              </button>
            ) : null}
            {steamError && !steamFriends.length ? (
              <button
                className={secondaryButtonClass}
                onClick={() => void loadFirstSteamPage()}
                type="button"
              >
                Retry Steam friends
              </button>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}

function FriendCard({
  friend,
  games,
  gamesLoading,
  gamesError,
  selectedGame,
  onGameChange,
}: {
  friend: SocialMe["friends"][number];
  games: SocialCommonGame[];
  gamesLoading: boolean;
  gamesError: string;
  selectedGame: string;
  onGameChange: (game: string) => void;
}) {
  return (
    <article className={cardClass}>
      <div className="flex items-center gap-3">
        <Avatar avatar={friend.avatar} nickname={friend.nickname} />
        <div className="min-w-0">
          <h3 className="truncate font-bold">{friend.nickname}</h3>
          <a
            className="text-xs font-bold text-primary"
            href={`/users/${encodeURIComponent(friend.public_id)}`}
          >
            View profile
          </a>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <a className={primaryButtonClass} href={messageHref(friend.id)}>
          Message {friend.nickname}
        </a>
      </div>
      {gamesLoading ? (
        <p className="mt-4 text-xs text-muted-foreground" role="status">
          Checking shared Steam games…
        </p>
      ) : gamesError ? (
        <p className="mt-4 text-xs text-muted-foreground">
          Shared Steam games unavailable.
        </p>
      ) : null}
      {games.length ? (
        <div className="mt-4 border-t border-border pt-4">
          <label
            className="block text-xs font-bold"
            htmlFor={`invite-game-${friend.id}`}
          >
            Game to invite {friend.nickname} to
          </label>
          <select
            className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            id={`invite-game-${friend.id}`}
            onChange={(event) => onGameChange(event.target.value)}
            value={selectedGame}
          >
            <option value="">Choose a shared Steam game</option>
            {games.map((game) => (
              <option key={game.appid} value={game.name}>
                {game.name}
              </option>
            ))}
          </select>
          {selectedGame ? (
            <a
              className={`${secondaryButtonClass} mt-3 inline-flex`}
              href={messageHref(friend.id, selectedGame)}
            >
              Invite {friend.nickname} to play
            </a>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function RequestList({
  title,
  requests,
  busyId,
  onAccept,
  onDecline,
}: {
  title: string;
  requests: SocialRequest[];
  busyId: string;
  onAccept: (request: SocialRequest) => void;
  onDecline: (request: SocialRequest) => void;
}) {
  return (
    <section aria-label={title} className="space-y-3">
      <h2 className="text-xl font-bold">{title}</h2>
      {requests.length ? (
        requests.map((request) => (
          <article className={cardClass} key={request.id}>
            <div className="flex items-center gap-3">
              <Avatar avatar={request.avatar} nickname={request.nickname} />
              <p className="font-bold">{request.nickname}</p>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                aria-label={`Accept ${request.nickname}`}
                className={primaryButtonClass}
                disabled={Boolean(busyId)}
                onClick={() => onAccept(request)}
                type="button"
              >
                Accept
              </button>
              <button
                aria-label={`Decline ${request.nickname}`}
                className={secondaryButtonClass}
                disabled={Boolean(busyId)}
                onClick={() => onDecline(request)}
                type="button"
              >
                Decline
              </button>
            </div>
          </article>
        ))
      ) : (
        <p className="text-sm text-muted-foreground">No incoming requests.</p>
      )}
    </section>
  );
}

function OutgoingList({
  requests,
  busyId,
  onCancel,
}: {
  requests: SocialRequest[];
  busyId: string;
  onCancel: (request: SocialRequest) => void;
}) {
  return (
    <section aria-label="Outgoing requests" className="space-y-3">
      <h2 className="text-xl font-bold">Outgoing requests</h2>
      {requests.length ? (
        requests.map((request) => (
          <article className={cardClass} key={request.id}>
            <p className="font-bold">{request.nickname}</p>
            <button
              aria-label={`Cancel request to ${request.nickname}`}
              className={`${secondaryButtonClass} mt-4`}
              disabled={Boolean(busyId)}
              onClick={() => onCancel(request)}
              type="button"
            >
              Cancel request
            </button>
          </article>
        ))
      ) : (
        <p className="text-sm text-muted-foreground">No outgoing requests.</p>
      )}
    </section>
  );
}

function PlayerCard({
  player,
  social,
  busyId,
  onAdd,
  onCancel,
  onAccept,
  onDecline,
}: {
  player: SocialPlayer;
  social: SocialMe;
  busyId: string;
  onAdd: () => void;
  onCancel: (request: SocialRequest) => void;
  onAccept: (request: SocialRequest) => void;
  onDecline: (request: SocialRequest) => void;
}) {
  const friend = social.friends.find(
    (item) => item.public_id === player.public_id,
  );
  const incoming = social.incoming_requests.find(
    (item) => item.public_id === player.public_id,
  );
  const outgoing = social.outgoing_requests.find(
    (item) => item.public_id === player.public_id,
  );
  return (
    <article className={cardClass}>
      <div className="flex items-center gap-3">
        <Avatar avatar={player.avatar} nickname={player.nickname} />
        <div>
          <h3 className="font-bold">{player.nickname}</h3>
          <a
            className="text-xs text-primary"
            href={`/users/${encodeURIComponent(player.public_id)}`}
          >
            Public profile
          </a>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {friend ? (
          <a className={primaryButtonClass} href={messageHref(friend.id)}>
            Message {player.nickname}
          </a>
        ) : incoming ? (
          <>
            <button
              aria-label={`Accept ${player.nickname}`}
              className={primaryButtonClass}
              disabled={Boolean(busyId)}
              onClick={() => onAccept(incoming)}
              type="button"
            >
              Accept
            </button>
            <button
              aria-label={`Decline ${player.nickname}`}
              className={secondaryButtonClass}
              disabled={Boolean(busyId)}
              onClick={() => onDecline(incoming)}
              type="button"
            >
              Decline
            </button>
          </>
        ) : outgoing ? (
          <button
            aria-label={`Cancel request to ${player.nickname}`}
            className={secondaryButtonClass}
            disabled={Boolean(busyId)}
            onClick={() => onCancel(outgoing)}
            type="button"
          >
            Cancel request
          </button>
        ) : (
          <button
            aria-label={`Add ${player.nickname}`}
            className={primaryButtonClass}
            disabled={Boolean(busyId)}
            onClick={onAdd}
            type="button"
          >
            Add friend
          </button>
        )}
      </div>
    </article>
  );
}

function SteamFriendCard({ friend }: { friend: SteamFriend }) {
  return (
    <article className={cardClass}>
      <div className="flex items-center gap-3">
        <Avatar
          avatar={friend.avatar}
          nickname={friend.persona_name ?? "Steam friend"}
        />
        <div>
          <h3 className="font-bold">{friend.persona_name ?? "Steam friend"}</h3>
          <p className="text-xs text-muted-foreground">
            {friend.library_public
              ? `${friend.common_games_count} games in common`
              : "Private game library"}
          </p>
        </div>
      </div>
      {friend.library_public ? (
        <p className="mt-3 text-sm text-muted-foreground">
          {friend.taste_match_percent}% taste match
        </p>
      ) : null}
    </article>
  );
}
