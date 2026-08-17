import { Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Avatar, GameCover } from "@/components/GameCover";
import { Chip, EmptyState, Panel, PresenceDot, SectionHeader } from "@/components/ui-bits";
import { ConnectedServices } from "@/components/ConnectedServices";
import { FriendConversationHistory } from "@/components/FriendConversationHistory";
import { NotificationsPanel } from "@/components/NotificationsPanel";
import {
  createConversation,
  createGameInvite,
  createMessage,
  type SharedLibrary,
  updateProfile,
} from "@/lib/api";
import { LogOut, MessageCircle, Settings, UserPlus, Gamepad2, Library } from "lucide-react";

const GENRE_OPTIONS = [
  "Action",
  "Adventure",
  "RPG",
  "Strategy",
  "Indie",
  "Shooter",
  "Puzzle",
  "Simulation",
  "Sports",
  "Racing",
  "Horror",
];
const PLATFORM_OPTIONS = ["PC", "PlayStation", "Xbox", "Nintendo Switch", "Mobile"];

function toggle(values: string[], value: string) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function formatPlaytime(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return hours > 0 ? (remainder > 0 ? `${hours}h ${remainder}m` : `${hours}h`) : `${remainder}m`;
}

export type ProfileData = {
  name: string;
  handle: string;
  avatarFrom: string;
  avatarTo: string;
  avatarUrl?: string;
  region: string;
  online?: boolean;
  bio?: string;
  compatibility?: number;
  hours: string | number;
  stores: { name: string; count: number; note: string }[];
  games: {
    id: string;
    title: string;
    coverFrom: string;
    coverTo: string;
    coverUrl?: string;
    playtime?: number | null;
    source?: string;
  }[];
  favorites?: {
    catalog_game_id: number;
    title: string;
    cover_url?: string | null;
  }[];
  activity?: { id: number | string; text: string; time: string }[];
  sharedLibrary?: SharedLibrary;
  friendId?: string;
  settings?: {
    displayName: string;
    bio: string;
    libraryVisibility: "public" | "friends" | "private";
    favoritesVisibility: "public" | "friends" | "private";
    wishlistVisibility: "public" | "friends" | "private";
    steamVisibility: "public" | "friends" | "private";
    platforms: string[];
    favoriteGenres: string[];
  };
};

export function ProfileView({
  profile,
  isSelf,
  initialComposer,
}: {
  profile: ProfileData;
  isSelf: boolean;
  initialComposer?: "message" | "invite";
}) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [displayName, setDisplayName] = useState(profile.settings?.displayName ?? profile.name);
  const [bio, setBio] = useState(profile.settings?.bio ?? profile.bio ?? "");
  const [libraryVisibility, setLibraryVisibility] = useState(
    profile.settings?.libraryVisibility ?? "public",
  );
  const [favoritesVisibility, setFavoritesVisibility] = useState(
    profile.settings?.favoritesVisibility ?? "public",
  );
  const [wishlistVisibility, setWishlistVisibility] = useState(
    profile.settings?.wishlistVisibility ?? "public",
  );
  const [steamVisibility, setSteamVisibility] = useState(
    profile.settings?.steamVisibility ?? "public",
  );
  const [platforms, setPlatforms] = useState(profile.settings?.platforms ?? []);
  const [favoriteGenres, setFavoriteGenres] = useState(profile.settings?.favoriteGenres ?? []);
  const [messageOpen, setMessageOpen] = useState(initialComposer === "message");
  const [messageBody, setMessageBody] = useState("");
  const messageTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [inviteOpen, setInviteOpen] = useState(initialComposer === "invite");
  const [selectedGameKey, setSelectedGameKey] = useState("");
  const queryClient = useQueryClient();
  const resetMessageComposer = () => {
    setMessageBody("");
    if (messageTextareaRef.current) messageTextareaRef.current.style.height = "";
  };
  const resizeMessageTextarea = () => {
    const textarea = messageTextareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 240)}px`;
  };
  const saveSettings = useMutation({
    mutationFn: updateProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["genre-deals"] });
      setSettingsOpen(false);
    },
  });
  const sendMessage = useMutation({
    mutationFn: async () => {
      if (!profile.friendId) throw new Error("Friend not available");
      const conversation = await createConversation(profile.friendId);
      return createMessage(conversation.id, messageBody.trim());
    },
    onSuccess: () => {
      resetMessageComposer();
      setMessageOpen(false);
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      queryClient.invalidateQueries({ queryKey: ["conversation-messages"] });
    },
  });
  const sendInvite = useMutation({
    mutationFn: () => {
      if (!profile.friendId) throw new Error("Friend not available");
      const game = profile.sharedLibrary?.data.find(
        (item) => `${item.source}:${item.external_id}` === selectedGameKey,
      );
      if (!game) throw new Error("Select a shared game");
      return createGameInvite({
        recipient_id: profile.friendId,
        game_name: game.title,
        source: game.source,
        external_id: game.external_id,
      });
    },
    onSuccess: () => {
      setSelectedGameKey("");
      setInviteOpen(false);
      queryClient.invalidateQueries({ queryKey: ["game-invites"] });
    },
  });
  const steam = profile.stores.find((s) => s.name === "Steam")?.count ?? 0;
  const psn = profile.stores.find((s) => s.name === "PlayStation")?.count ?? 0;

  return (
    <>
      <Panel className="ember-glow grain mb-8 flex flex-col items-start gap-5 p-6 sm:flex-row sm:items-center">
        <div className="relative shrink-0">
          <Avatar
            from={profile.avatarFrom}
            to={profile.avatarTo}
            name={profile.name}
            image={profile.avatarUrl}
            className="relative size-16 rounded-2xl"
          />
          {!isSelf && (
            <span className="absolute -bottom-1 -right-1">
              {profile.online != null && <PresenceDot online={profile.online} />}
            </span>
          )}
        </div>
        <div className="relative min-w-0 flex-1">
          <h1 className="truncate text-2xl font-bold tracking-[-0.02em]">{profile.name}</h1>
          <p className="truncate text-sm text-muted-foreground">@{profile.handle}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Chip tone="primary">Region · {profile.region}</Chip>
            {!isSelf && <Chip tone="outline">{profile.games.length} games synced</Chip>}
            {!isSelf && profile.compatibility != null && (
              <Chip tone="primary">{profile.compatibility}% compatible</Chip>
            )}
            {!isSelf && (
              <>
                <Chip tone={steam > 0 ? "primary" : "outline"}>
                  Steam {steam > 0 ? "connected" : "not connected"}
                </Chip>
                <Chip tone={psn > 0 ? "primary" : "outline"}>
                  PSN {psn > 0 ? "connected" : "not connected"}
                </Chip>
              </>
            )}
          </div>
        </div>
        <div className="relative flex shrink-0 gap-2">
          {isSelf ? (
            <>
              <button
                onClick={() => setSettingsOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-bold transition hover:border-primary/50"
              >
                <Settings className="size-4" /> Settings
              </button>
              <Link
                to="/sign-in"
                className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-bold text-muted-foreground transition hover:text-foreground"
              >
                <LogOut className="size-4" /> Sign out
              </Link>
            </>
          ) : (
            <>
              <button
                onClick={() => {
                  setSelectedGameKey(
                    profile.sharedLibrary?.data[0]
                      ? `${profile.sharedLibrary.data[0].source}:${profile.sharedLibrary.data[0].external_id}`
                      : "",
                  );
                  setInviteOpen(true);
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground"
              >
                <UserPlus className="size-4" /> Invite to play
              </button>
              <button
                onClick={() => setMessageOpen(true)}
                aria-label={`Message ${profile.name}`}
                className="grid size-11 place-items-center rounded-xl border border-border transition hover:border-primary/50"
              >
                <MessageCircle className="size-4" />
              </button>
            </>
          )}
        </div>
      </Panel>

      {isSelf && settingsOpen && (
        <div
          role="dialog"
          aria-label="Profile settings"
          className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              saveSettings.mutate({
                display_name: displayName.trim(),
                bio: bio.trim() || null,
                library_visibility: libraryVisibility,
                favorites_visibility: favoritesVisibility,
                wishlist_visibility: wishlistVisibility,
                steam_visibility: steamVisibility,
                platforms,
                favorite_genres: favoriteGenres,
              });
            }}
            className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-2xl"
          >
            <h2 className="text-xl font-bold">Profile settings</h2>
            <label className="mt-5 block text-sm font-semibold">
              Display name
              <input
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                required
                minLength={3}
                className="mt-2 w-full rounded-lg border border-border bg-surface-2 px-3 py-2"
              />
            </label>
            <label className="mt-4 block text-sm font-semibold">
              Bio
              <textarea
                value={bio}
                onChange={(event) => setBio(event.target.value)}
                maxLength={1000}
                className="mt-2 min-h-24 w-full rounded-lg border border-border bg-surface-2 px-3 py-2"
              />
            </label>
            <PreferenceChips
              label="Favourite genres"
              options={GENRE_OPTIONS}
              selected={favoriteGenres}
              onToggle={(value) => setFavoriteGenres(toggle(favoriteGenres, value))}
            />
            <PreferenceChips
              label="Platforms"
              options={PLATFORM_OPTIONS}
              selected={platforms}
              onToggle={(value) => setPlatforms(toggle(platforms, value))}
            />
            <label className="mt-4 block text-sm font-semibold">
              Library visibility
              <select
                value={libraryVisibility}
                onChange={(event) =>
                  setLibraryVisibility(event.target.value as "public" | "friends" | "private")
                }
                className="mt-2 w-full rounded-lg border border-border bg-surface-2 px-3 py-2"
              >
                <option value="public">Public</option>
                <option value="friends">Friends</option>
                <option value="private">Private</option>
              </select>
            </label>
            <p className="mt-3 text-xs text-muted-foreground">
              These settings control what visitors can see on your public profile.
            </p>
            {[
              ["Favorites visibility", favoritesVisibility, setFavoritesVisibility],
              ["Wishlist visibility", wishlistVisibility, setWishlistVisibility],
              ["Steam profile visibility", steamVisibility, setSteamVisibility],
            ].map(([label, value, setValue]) => (
              <label key={label as string} className="mt-4 block text-sm font-semibold">
                {label as string}
                <select
                  value={value as string}
                  onChange={(event) =>
                    (setValue as (value: "public" | "friends" | "private") => void)(
                      event.target.value as "public" | "friends" | "private",
                    )
                  }
                  className="mt-2 w-full rounded-lg border border-border bg-surface-2 px-3 py-2"
                >
                  <option value="public">Public</option>
                  <option value="friends">Friends only</option>
                  <option value="private">Only me</option>
                </select>
              </label>
            ))}
            {saveSettings.isError && (
              <p className="mt-3 text-sm text-destructive">
                Could not save settings. Check that the display name is available.
              </p>
            )}
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                className="rounded-lg border border-border px-4 py-2 text-sm font-bold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saveSettings.isPending}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
              >
                {saveSettings.isPending ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        </div>
      )}
      {!isSelf &&
        messageOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            role="dialog"
            aria-label={`Message ${profile.name}`}
            className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"
          >
            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (messageBody.trim()) sendMessage.mutate();
              }}
              className="relative z-[60] w-full max-w-md rounded-2xl border border-border bg-surface p-6 text-foreground shadow-2xl"
            >
              <h2 className="text-xl font-bold">Message {profile.name}</h2>
              <textarea
                aria-label="Message text"
                ref={messageTextareaRef}
                value={messageBody}
                onChange={(event) => {
                  setMessageBody(event.target.value);
                  resizeMessageTextarea();
                }}
                required
                maxLength={2000}
                className="mt-4 min-h-28 w-full resize-none overflow-y-auto rounded-lg border border-border bg-surface-2 p-3"
              />
              {sendMessage.isError && (
                <p role="alert" className="mt-2 text-sm text-destructive">
                  Could not send message.
                </p>
              )}
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    resetMessageComposer();
                    setMessageOpen(false);
                  }}
                  className="rounded-lg px-3 py-2 text-sm font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={sendMessage.isPending}
                  className="rounded-lg bg-primary px-3 py-2 text-sm font-bold text-primary-foreground"
                >
                  Send
                </button>
              </div>
            </form>
          </div>,
          document.body,
        )}
      {!isSelf &&
        inviteOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            role="dialog"
            aria-label={`Invite ${profile.name}`}
            className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"
          >
            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (selectedGameKey) sendInvite.mutate();
              }}
              className="relative z-[60] w-full max-w-md rounded-2xl border border-border bg-surface p-6 text-foreground shadow-2xl"
            >
              <h2 className="text-xl font-bold">Invite {profile.name} to play</h2>
              <label className="mt-4 grid gap-2 text-sm font-semibold">
                Game
                <select
                  aria-label="Game"
                  value={selectedGameKey}
                  onChange={(event) => setSelectedGameKey(event.target.value)}
                  required
                  className="rounded-lg border border-border bg-surface-2 p-3"
                >
                  <option value="">Choose a shared game</option>
                  {profile.sharedLibrary?.data.map((game) => (
                    <option
                      key={`${game.source}:${game.external_id}`}
                      value={`${game.source}:${game.external_id}`}
                    >
                      {game.title}
                    </option>
                  ))}
                </select>
              </label>
              {!profile.sharedLibrary?.data.length && (
                <p className="mt-2 text-sm text-muted-foreground">
                  A shared saved game is required before you can send an invite.
                </p>
              )}
              {sendInvite.isError && (
                <p role="alert" className="mt-2 text-sm text-destructive">
                  Could not send invite.
                </p>
              )}
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setInviteOpen(false)}
                  className="rounded-lg px-3 py-2 text-sm font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={sendInvite.isPending || !selectedGameKey}
                  className="rounded-lg bg-primary px-3 py-2 text-sm font-bold text-primary-foreground"
                >
                  Send invite
                </button>
              </div>
            </form>
          </div>,
          document.body,
        )}

      <div className="mb-8 flex flex-wrap items-center gap-x-8 gap-y-4 rounded-2xl border border-border bg-surface-2 px-5 py-4">
        {[
          ...(!isSelf ? [{ l: "Games", v: profile.games.length }] : []),
          { l: "Steam", v: steam },
          { l: "PlayStation", v: psn },
          { l: "Hours", v: profile.hours },
        ].map((s) => (
          <div key={s.l} className="min-w-[72px]">
            <p className="label-mono text-muted-foreground">{s.l}</p>
            <p className="font-mono text-lg font-bold leading-tight">{s.v}</p>
          </div>
        ))}
        {profile.bio && (
          <p className="min-w-[200px] flex-1 text-sm text-muted-foreground">{profile.bio}</p>
        )}
      </div>

      <div className="stagger grid grid-cols-1 gap-5 lg:grid-cols-12">
        {isSelf ? (
          <>
            <NotificationsPanel className="lg:col-span-7" />

            <div className="lg:col-span-5">
              <ConnectedServices />
            </div>
          </>
        ) : (
          <>
            {profile.activity && (
              <Panel className="p-6 lg:col-span-12">
                <SectionHeader title="Recent activity" />
                {profile.activity && profile.activity.length > 0 ? (
                  <div className="space-y-3">
                    {profile.activity.map((a) => (
                      <div
                        key={a.id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-2 px-4 py-3"
                      >
                        <span className="min-w-0 truncate text-sm">{a.text}</span>
                        <span className="label-mono shrink-0 text-muted-foreground">{a.time}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState title="No recent activity" description="Nothing to show yet." />
                )}
              </Panel>
            )}
          </>
        )}

        {isSelf && (
          <Panel className="p-6 lg:col-span-12">
            <SectionHeader title="Favorites" hint="Games that reflect your taste" />
            {profile.favorites?.length ? (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {profile.favorites.map((favorite) => (
                  <Link
                    key={favorite.catalog_game_id}
                    to="/games/$gameId"
                    params={{ gameId: String(favorite.catalog_game_id) }}
                    className="rounded-xl border border-border bg-surface-2 p-3 text-sm font-bold hover:border-primary/40"
                  >
                    {favorite.title}
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyState
                title="No favorites yet"
                description="Favorites reflect your taste, not games you plan to buy."
              />
            )}
          </Panel>
        )}

        {!isSelf && profile.friendId && (
          <Panel className="p-6 lg:col-span-12">
            <FriendConversationHistory friendId={profile.friendId} />
          </Panel>
        )}

        {!isSelf && (
          <Panel className="p-6 lg:col-span-12">
            <SectionHeader
              title="Shared games"
              hint={`${profile.sharedLibrary?.data.length ?? 0} saved matches`}
            />
            {profile.sharedLibrary?.status === "ready" ? (
              <div className="stagger grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {profile.sharedLibrary.data.map((game) => (
                  <div
                    key={`${game.source}:${game.external_id}`}
                    className="rounded-xl border border-border bg-surface-2 p-3"
                  >
                    <p className="truncate text-sm font-bold">{game.title}</p>
                    <p className="label-mono mt-1.5 text-muted-foreground">{game.source}</p>
                    <button
                      type="button"
                      aria-label={`Invite ${game.title}`}
                      onClick={() => {
                        setSelectedGameKey(`${game.source}:${game.external_id}`);
                        setInviteOpen(true);
                      }}
                      className="mt-3 w-full rounded-md bg-primary px-2 py-1.5 text-xs font-bold text-primary-foreground"
                    >
                      Invite
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<Gamepad2 className="size-5" />}
                title={
                  profile.sharedLibrary?.status === "private"
                    ? "Shared library unavailable"
                    : profile.sharedLibrary?.status === "disconnected"
                      ? "Steam connection required"
                      : profile.sharedLibrary?.status === "error"
                        ? "Shared games unavailable"
                        : "No shared saved games"
                }
                description={profile.sharedLibrary?.message ?? "No shared saved games yet."}
              />
            )}
          </Panel>
        )}

        {!isSelf && (
          <Panel className="p-6 lg:col-span-12">
            <SectionHeader
              title={isSelf ? "Your library" : "Their library"}
              hint={`${profile.games.length} games`}
            />
            {profile.games.length === 0 ? (
              <EmptyState
                icon={<Library className="size-5" />}
                title="No games yet"
                description={
                  isSelf
                    ? "Connect Steam or import your PlayStation library to fill this in."
                    : "This player hasn't shared any games."
                }
                action={
                  isSelf ? (
                    <Link
                      to="/psn-import"
                      className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
                    >
                      Import PlayStation library
                    </Link>
                  ) : undefined
                }
              />
            ) : (
              <div className="stagger grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {profile.games.map((g) => (
                  <Link
                    key={g.id}
                    to="/games/$gameId"
                    params={{ gameId: g.id }}
                    className="hover-lift overflow-hidden rounded-xl border border-border bg-surface-2 hover:border-primary/40"
                  >
                    <GameCover
                      from={g.coverFrom}
                      to={g.coverTo}
                      title={g.title}
                      image={g.coverUrl}
                      bare
                      className="aspect-video w-full"
                    />
                    <div className="p-3">
                      <p className="truncate text-sm font-bold">{g.title}</p>
                      <p className="label-mono mt-1.5 flex items-center gap-1.5 text-muted-foreground">
                        <Gamepad2 className="size-3" />
                        {g.playtime != null ? formatPlaytime(g.playtime) : (g.source ?? "Owned")}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Panel>
        )}
      </div>
    </>
  );
}

function PreferenceChips({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  const values = [...options, ...selected.filter((value) => !options.includes(value))];
  return (
    <fieldset className="mt-4">
      <legend className="text-sm font-semibold">{label}</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {values.map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={selected.includes(value)}
            onClick={() => onToggle(value)}
            className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${selected.includes(value) ? "border-primary bg-primary/15 text-primary" : "border-border"}`}
          >
            {value}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
