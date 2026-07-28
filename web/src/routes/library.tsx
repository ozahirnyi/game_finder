import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { GameCover } from "@/components/GameCover";
import { Chip, SectionHeader } from "@/components/ui-bits";
import { games } from "@/lib/mockData";
import { useState } from "react";

export const Route = createFileRoute("/library")({
  head: () => ({
    meta: [
      { title: "Library — Playfinder" },
      {
        name: "description",
        content:
          "Your synced library across storefronts, with statuses and shared-with-friends visibility.",
      },
    ],
  }),
  component: LibraryPage,
});

const tabs = ["All games", "Steam", "PlayStation"] as const;

function LibraryPage() {
  const [tab, setTab] = useState<(typeof tabs)[number]>("All games");
  const owned = games.filter((g) => g.source);
  const visible = tab === "All games" ? owned : owned.filter((g) => g.source === tab);
  return (
    <AppShell>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <SectionHeader
            title="Library"
            hint={`${owned.length} games synced from Steam and PlayStation`}
          />
        </div>
        <div className="flex items-center gap-6 font-mono">
          {[
            { l: "Games", v: owned.length },
            { l: "Steam", v: owned.filter((g) => g.source === "Steam").length },
            {
              l: "PlayStation",
              v: owned.filter((g) => g.source === "PlayStation").length,
            },
            { l: "Hours", v: "2,140" },
          ].map((s) => (
            <div key={s.l}>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{s.l}</p>
              <p className="text-xl font-bold">{s.v}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-8 flex flex-wrap gap-2 border-b border-border pb-4">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
              t === tab
                ? "bg-foreground/5 text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div key={tab} className="stagger space-y-3">
        {visible.map((g) => (
          <Link
            key={g.id}
            to="/games/$gameId"
            params={{ gameId: g.id }}
            className="hover-lift group grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-5 rounded-xl border border-border bg-surface p-4 hover:border-primary/40 sm:grid-cols-[auto_minmax(0,1fr)_auto_auto]"
          >
            <GameCover
              from={g.coverFrom}
              to={g.coverTo}
              title={g.title}
              compact
              className="size-16 shrink-0 rounded-lg"
            />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="truncate font-bold transition-colors group-hover:text-primary">
                  {g.title}
                </h4>
                {g.status === "Playing with Friends" && <Chip tone="primary">Squad · 3</Chip>}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {g.genres.join(" · ")} · {g.platforms.join(", ")}
              </p>
            </div>
            <div className="hidden text-right sm:block">
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Source
              </p>
              <p className="text-sm font-bold">{g.source}</p>
            </div>
            <div className="text-right">
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Playtime
              </p>
              <p className="font-mono text-sm font-bold">{g.playtime ?? 0}h</p>
            </div>
          </Link>
        ))}
      </div>
    </AppShell>
  );
}
