import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { GameCover } from "@/components/GameCover";
import { Chip, EmptyState, SectionHeader } from "@/components/ui-bits";
import { getLibrary } from "@/lib/api";
import { libraryPlaytime, librarySource } from "@/lib/collectionPresentation";
import { useState } from "react";
import { Library as LibraryIcon, Gamepad2 } from "lucide-react";

export const Route = createFileRoute("/library")({
  head: () => ({
    meta: [
      { title: "Library — Playfinder" },
      {
        name: "description",
        content:
          "Your synced library across storefronts: everything you own from Steam and PlayStation in one place.",
      },
      { property: "og:title", content: "Library — Playfinder" },
      {
        property: "og:description",
        content: "All the games you own from Steam and PlayStation, in one library.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LibraryPage,
});

const tabs = ["All games", "Steam", "PlayStation"] as const;
type Tab = (typeof tabs)[number];

function LibraryPage() {
  const [tab, setTab] = useState<Tab>("All games");
  const libraryQuery = useQuery({ queryKey: ["library"], queryFn: getLibrary });

  const owned = libraryQuery.data ?? [];
  const visible =
    tab === "All games" ? owned : owned.filter((g) => librarySource(g.source) === tab);

  return (
    <AppShell>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <SectionHeader title="Library" hint="Everything you own, across connected stores" />
        <div className="flex items-center gap-6 font-mono">
          {[
            { l: "Games", v: owned.length },
            { l: "Steam", v: owned.filter((g) => librarySource(g.source) === "Steam").length },
            {
              l: "PlayStation",
              v: owned.filter((g) => librarySource(g.source) === "PlayStation").length,
            },
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

      {visible.length === 0 && (
        <EmptyState
          icon={<LibraryIcon className="size-5" />}
          title={
            tab === "Steam"
              ? "Connect Steam to see your games"
              : tab === "PlayStation"
                ? "Import your PlayStation library"
                : "Your library is empty"
          }
          description={
            tab === "Steam"
              ? "Link your Steam account and we'll sync everything you own automatically."
              : tab === "PlayStation"
                ? "Upload a PlayStation export and we'll match your games to the catalog."
                : "Connect Steam or import PlayStation to fill your library."
          }
          action={
            <>
              {tab !== "PlayStation" && (
                <Link
                  to="/account"
                  className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
                >
                  Connect Steam
                </Link>
              )}
              {tab !== "Steam" && (
                <Link
                  to="/psn-import"
                  className="rounded-xl border border-border bg-surface px-4 py-2 text-sm font-bold"
                >
                  Import PlayStation
                </Link>
              )}
            </>
          }
        />
      )}

      {visible.length > 0 && (
        <div key={tab} className="stagger space-y-3">
          {visible.map((g) => (
            <div
              key={g.id}
              className="hover-lift group grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-5 rounded-xl border border-border bg-surface p-4 hover:border-primary/40 sm:grid-cols-[auto_minmax(0,1fr)_auto_auto]"
            >
              <GameCover
                from="#1d4ed8"
                to="#111827"
                title={g.title}
                image={g.cover_url ?? undefined}
                compact
                bare
                className="size-16 shrink-0 rounded-lg"
              />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="truncate font-bold transition-colors group-hover:text-primary">
                    {g.title}
                  </h4>
                  <Chip tone="primary">Owned</Chip>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {g.notes || "Synced from your connected library"}
                </p>
              </div>
              <div className="hidden text-right sm:block">
                <p className="label-mono text-muted-foreground">Source</p>
                <p className="text-sm font-bold">{librarySource(g.source)}</p>
              </div>
              <div className="text-right">
                <p className="label-mono text-muted-foreground">Playtime</p>
                <p className="flex items-center justify-end gap-1.5 font-mono text-sm font-bold">
                  <Gamepad2 className="size-3.5 text-muted-foreground" />
                  {libraryPlaytime(g.playtime_forever)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
