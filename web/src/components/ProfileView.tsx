import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Avatar, GameCover } from "@/components/GameCover";
import { Chip, EmptyState, Panel, PresenceDot, SectionHeader } from "@/components/ui-bits";
import { ConnectedServices } from "@/components/ConnectedServices";
import { NotificationsPanel } from "@/components/NotificationsPanel";
import { createConversation, createGameInvite, createMessage, updateProfile } from "@/lib/api";
import { LogOut, MessageCircle, Settings, UserPlus, Gamepad2, Library } from "lucide-react";

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
  activity?: { id: number | string; text: string; time: string }[];
  friendId?: string;
  settings?: {
    displayName: string;
    bio: string;
    libraryVisibility: "public" | "friends" | "private";
  };
};

export function ProfileView({ profile, isSelf, initialComposer }: { profile: ProfileData; isSelf: boolean; initialComposer?: "message" | "invite" }) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [displayName, setDisplayName] = useState(profile.settings?.displayName ?? profile.name);
  const [bio, setBio] = useState(profile.settings?.bio ?? profile.bio ?? "");
  const [libraryVisibility, setLibraryVisibility] = useState(
    profile.settings?.libraryVisibility ?? "public",
  );
  const [messageOpen, setMessageOpen] = useState(initialComposer === "message");
  const [messageBody, setMessageBody] = useState("");
  const [inviteOpen, setInviteOpen] = useState(initialComposer === "invite");
  const [gameName, setGameName] = useState("");
  const queryClient = useQueryClient();
  const saveSettings = useMutation({
    mutationFn: updateProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      setSettingsOpen(false);
    },
  });
  const sendMessage = useMutation({
    mutationFn: async () => {
      if (!profile.friendId) throw new Error("Friend not available");
      const conversation = await createConversation(profile.friendId);
      return createMessage(conversation.id, messageBody.trim());
    },
    onSuccess: () => { setMessageBody(""); setMessageOpen(false); },
  });
  const sendInvite = useMutation({
    mutationFn: () => {
      if (!profile.friendId) throw new Error("Friend not available");
      return createGameInvite({ recipient_id: profile.friendId, game_name: gameName.trim() });
    },
    onSuccess: () => { setGameName(""); setInviteOpen(false); },
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
              <PresenceDot online={!!profile.online} />
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
              <button onClick={() => setInviteOpen(true)} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground">
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
      {!isSelf && messageOpen && (
        <div role="dialog" aria-label={`Message ${profile.name}`} className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
          <form onSubmit={(event) => { event.preventDefault(); if (messageBody.trim()) sendMessage.mutate(); }} className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-2xl">
            <h2 className="text-xl font-bold">Message {profile.name}</h2>
            <textarea aria-label="Message text" value={messageBody} onChange={(event) => setMessageBody(event.target.value)} required maxLength={2000} className="mt-4 min-h-28 w-full rounded-lg border border-border bg-surface-2 p-3" />
            {sendMessage.isError && <p role="alert" className="mt-2 text-sm text-destructive">Could not send message.</p>}
            <div className="mt-4 flex justify-end gap-2"><button type="button" onClick={() => setMessageOpen(false)} className="rounded-lg px-3 py-2 text-sm font-bold">Cancel</button><button type="submit" disabled={sendMessage.isPending} className="rounded-lg bg-primary px-3 py-2 text-sm font-bold text-primary-foreground">Send</button></div>
          </form>
        </div>
      )}
      {!isSelf && inviteOpen && (
        <div role="dialog" aria-label={`Invite ${profile.name}`} className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
          <form onSubmit={(event) => { event.preventDefault(); if (gameName.trim()) sendInvite.mutate(); }} className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-2xl">
            <h2 className="text-xl font-bold">Invite {profile.name} to play</h2>
            <input aria-label="Game name" value={gameName} onChange={(event) => setGameName(event.target.value)} required maxLength={255} placeholder="Game name" className="mt-4 w-full rounded-lg border border-border bg-surface-2 p-3" />
            {sendInvite.isError && <p role="alert" className="mt-2 text-sm text-destructive">Could not send invite.</p>}
            <div className="mt-4 flex justify-end gap-2"><button type="button" onClick={() => setInviteOpen(false)} className="rounded-lg px-3 py-2 text-sm font-bold">Cancel</button><button type="submit" disabled={sendInvite.isPending} className="rounded-lg bg-primary px-3 py-2 text-sm font-bold text-primary-foreground">Send invite</button></div>
          </form>
        </div>
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
          </>
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
