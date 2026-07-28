import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { GameCover } from "@/components/GameCover";
import { Chip, SectionHeader } from "@/components/ui-bits";
import { getLibrary } from "@/lib/api";
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
  const libraryQuery = useQuery({ queryKey: ["library"], queryFn: getLibrary });
  const owned = libraryQuery.data ?? [];
  const sourceForTab = tab === "Steam" ? "steam" : tab === "PlayStation" ? "psn" : null;
  const visible = sourceForTab ? owned.filter((g) => g.source === sourceForTab) : owned;
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
              from="#c75f28"
              to="#22243a"
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
                {g.notes ?? "No description available"} · {g.source}
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
              <p className="font-mono text-sm font-bold">{Math.round((g.playtime_forever ?? 0) / 60)}h</p>
            </div>
          </Link>
        ))}
      </div>
    </AppShell>
  );
}
