import { Link } from "@tanstack/react-router";
import { Avatar, GameCover } from "@/components/GameCover";
import { Chip, Panel, PresenceDot, SectionHeader, Stat } from "@/components/ui-bits";
type Game = {
  id: string;
  title: string;
  coverFrom?: string;
  coverTo?: string;
  playtime?: number;
  source?: string;
};
import { LogOut, MessageCircle, Settings, UserPlus, Gamepad2 } from "lucide-react";

export type ProfileData = {
  name: string;
  handle: string;
  avatarFrom: string;
  avatarTo: string;
  region: string;
  online?: boolean;
  bio?: string;
  compatibility?: number;
  hours: string | number;
  stores: { name: string; count: number; note: string }[];
  games: Game[];
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
            <Chip tone="outline">{profile.games.length} games synced</Chip>
            {!isSelf && profile.compatibility != null && (
              <Chip tone="primary">{profile.compatibility}% compatible</Chip>
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
              <button className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition hover:opacity-90">
                <UserPlus className="size-4" /> Invite to play
              </button>
              <button className="grid size-11 place-items-center rounded-xl border border-border transition hover:border-primary/50">
                <MessageCircle className="size-4" />
              </button>
            </>
          )}
        </div>
      </Panel>

      <div className="stagger grid grid-cols-1 gap-5 lg:grid-cols-12">
        <Panel className="p-6 lg:col-span-7">
          <SectionHeader title="Overview" hint="Across connected stores" />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Games" value={profile.games.length} />
            <Stat label="Steam" value={steam} />
            <Stat label="PlayStation" value={psn} />
            <Stat label="Hours" value={profile.hours} />
          </div>
          {profile.bio && <p className="mt-5 text-sm text-muted-foreground">{profile.bio}</p>}
        </Panel>

        <Panel className={isSelf ? "p-6 lg:col-span-7" : "p-6 lg:col-span-5"}>
          <SectionHeader title="Connected stores" hint="Sources of the library" />
          <div className="space-y-3">
            {profile.stores.map((s) => (
              <div
                key={s.name}
                className="hover-lift flex items-center justify-between rounded-xl border border-border bg-surface-2 p-4"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{s.name}</p>
                  <p className="label-mono mt-1.5 text-muted-foreground">{s.note}</p>
                </div>
                <Chip tone="primary">{s.count} games</Chip>
              </div>
            ))}
          </div>
        </Panel>

        {isSelf ? (
          <Panel className="p-6 lg:col-span-5">
            <SectionHeader title="Notifications" hint="What we ping you about" />
            <div className="space-y-3">
              {[
                { label: "Price-drop alerts", value: "On · wishlist only" },
                { label: "Friend activity", value: "On" },
                { label: "Weekly deals digest", value: "Off" },
              ].map((n) => (
                <div
                  key={n.label}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-2 px-4 py-3"
                >
                  <span className="text-sm font-semibold">{n.label}</span>
                  <span className="label-mono text-muted-foreground">{n.value}</span>
                </div>
              ))}
            </div>
          </Panel>
        ) : (
          profile.activity &&
          profile.activity.length > 0 && (
            <Panel className="p-6 lg:col-span-7">
              <SectionHeader title="Recent activity" />
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
            </Panel>
          )
        )}

        <Panel className="p-6 lg:col-span-12">
          <SectionHeader
            title={isSelf ? "Your library" : "Their library"}
            hint={`${profile.games.length} games`}
          />
          <div className="stagger grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {profile.games.map((g) => (
              <Link
                key={g.id}
                to="/games/$gameId"
                params={{ gameId: g.id }}
                className="hover-lift overflow-hidden rounded-xl border border-border bg-surface-2 hover:border-primary/40"
              >
                <GameCover
                  from={g.coverFrom ?? "#c75f28"}
                  to={g.coverTo ?? "#22243a"}
                  title={g.title}
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
        </Panel>
      </div>
    </>
  );
}
