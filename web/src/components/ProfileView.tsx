import { Link } from "@tanstack/react-router";
import { Avatar, GameCover } from "@/components/GameCover";
import { Chip, EmptyState, Panel, PresenceDot, SectionHeader } from "@/components/ui-bits";
import { ConnectedServices } from "@/components/ConnectedServices";
import { NotificationsPanel } from "@/components/NotificationsPanel";
import { LogOut, MessageCircle, Settings, UserPlus, Gamepad2, Library } from "lucide-react";

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
};

export function ProfileView({ profile, isSelf }: { profile: ProfileData; isSelf: boolean }) {
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
              <button className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-bold transition hover:border-primary/50">
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
              <button disabled title="Invites are coming soon" className="inline-flex cursor-not-allowed items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground opacity-50">
                <UserPlus className="size-4" /> Invite to play
              </button>
              <button disabled aria-label="Messaging is coming soon" title="Messaging is coming soon" className="grid size-11 cursor-not-allowed place-items-center rounded-xl border border-border opacity-50">
                <MessageCircle className="size-4" />
              </button>
            </>
          )}
        </div>
      </Panel>

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
                      {g.playtime ? `${g.playtime}h` : (g.source ?? "Owned")}
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
