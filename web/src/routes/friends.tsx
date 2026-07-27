import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Avatar, GameCover } from "@/components/GameCover";
import { Chip, PresenceDot, SectionHeader } from "@/components/ui-bits";
import { friends, games, activity } from "@/lib/mockData";
import { Search, UserPlus, Gamepad2, MessageCircle } from "lucide-react";

export const Route = createFileRoute("/friends")({
  head: () => ({
    meta: [
      { title: "Friends — GameFinder" },
      {
        name: "description",
        content:
          "Your gaming circle: shared libraries, LFG opportunities, compatibility, and quick invites.",
      },
    ],
  }),
  component: FriendsPage,
});

function FriendsPage() {
  const focus = friends[0];
  const sharedGames = games.filter((g) =>
    ["helldivers2", "bg3", "drg", "hades2", "eldenring", "stardew"].includes(
      g.id,
    ),
  );

  return (
    <AppShell>
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
        <div className="space-y-10 lg:col-span-8">
          <div>
            <SectionHeader
              title="Friends"
              hint={`${friends.length} friends · ${friends.filter((f) => f.online).length} online now`}
              action={
                <button className="flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground">
                  <UserPlus className="size-3.5" /> Add friend
                </button>
              }
            />
            <div className="mb-6 flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3">
              <Search className="size-4 text-muted-foreground" />
              <input
                placeholder="Find players by game, language, platform, play style…"
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>

            <div className="space-y-3">
              {friends.map((f) => (
                <div
                  key={f.id}
                  className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 rounded-2xl border border-border bg-surface p-4 transition hover:border-white/20 sm:grid-cols-[auto_minmax(0,1fr)_auto_auto]"
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
                      {f.activity}
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
                    <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                      Compat
                    </p>
                    <p className="font-mono text-lg font-black text-primary">
                      {f.compatibility}%
                    </p>
                    <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                      {f.sharedGames} shared
                    </p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <button className="rounded-md bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground">
                      Invite to play
                    </button>
                    <button className="rounded-md border border-border bg-secondary px-3 py-1.5 text-xs font-bold">
                      Message
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <SectionHeader
              title="Play together with Sasha"
              hint="Filtered to games you both own · 2–4 players · co-op"
            />
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              {sharedGames.map((g) => (
                <div
                  key={g.id}
                  className="overflow-hidden rounded-xl border border-border bg-surface"
                >
                  <GameCover
                    from={g.coverFrom}
                    to={g.coverTo}
                    title={g.title}
                    className="aspect-video w-full"
                  />
                  <div className="p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-bold">{g.title}</p>
                      <Chip tone="primary">Both own</Chip>
                    </div>
                    <button className="mt-3 flex w-full items-center justify-center gap-2 rounded-md bg-secondary py-1.5 text-xs font-bold">
                      <Gamepad2 className="size-3.5" /> Invite
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right rail: focus card + activity */}
        <div className="space-y-8 lg:col-span-4">
          <div className="rounded-3xl border border-border bg-surface p-6">
            <div className="flex items-center gap-4">
              <Avatar
                from={focus.avatarFrom}
                to={focus.avatarTo}
                name={focus.name}
                className="size-16 rounded-2xl"
              />
              <div>
                <p className="font-bold">{focus.name}</p>
                <p className="font-mono text-xs text-muted-foreground">
                  @{focus.handle}
                </p>
              </div>
            </div>
            <div className="my-6 grid grid-cols-3 gap-3 border-y border-border py-4 text-center font-mono">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  Compat
                </p>
                <p className="text-xl font-black text-primary">
                  {focus.compatibility}%
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  Shared
                </p>
                <p className="text-xl font-black">{focus.sharedGames}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  Wishlist
                </p>
                <p className="text-xl font-black">7</p>
              </div>
            </div>
            <p className="mb-4 text-sm text-muted-foreground">
              Both play roguelikes and long-run RPGs. High overlap on co-op
              titles.
            </p>
            <div className="flex gap-2">
              <button className="flex-1 rounded-lg bg-primary px-3 py-2 text-sm font-bold text-primary-foreground">
                Invite to play
              </button>
              <button className="grid size-10 place-items-center rounded-lg border border-border">
                <MessageCircle className="size-4" />
              </button>
            </div>
          </div>

          <div>
            <SectionHeader title="Feed" />
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
                      {a.tag}.{" "}
                      <span className="text-muted-foreground/60">{a.time}</span>
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
