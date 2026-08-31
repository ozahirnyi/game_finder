import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Gamepad2, Library as LibraryIcon } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { GameCover } from "@/components/GameCover";
import { Chip, EmptyState, SectionHeader } from "@/components/ui-bits";
import { type LibraryOverviewGame } from "@/lib/api";
import { libraryPlaytime, librarySource } from "@/lib/collectionPresentation";
import { libraryOverviewQueryOptions } from "@/lib/navigationQueries";

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
type SortOrder = "playtime-desc" | "playtime-asc";

function LibraryPage() {
  const [tab, setTab] = useState<Tab>("All games");
  const [sortOrder, setSortOrder] = useState<SortOrder>("playtime-desc");
  const libraryQuery = useQuery(libraryOverviewQueryOptions());
  const owned = libraryQuery.data?.games ?? [];
  const sourceForTab = tab === "Steam" ? "steam" : tab === "PlayStation" ? "psn" : null;
  const visible = useMemo(() => {
    const filtered = sourceForTab ? owned.filter((game) => game.source === sourceForTab) : owned;
    return [...filtered].sort((left, right) => {
      const difference = (left.playtime_forever ?? 0) - (right.playtime_forever ?? 0);
      return sortOrder === "playtime-desc" ? -difference : difference;
    });
  }, [owned, sourceForTab, sortOrder]);

  return (
    <AppShell>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <SectionHeader title="Library" hint="Everything you own, across connected stores" />
        <div className="flex items-center gap-6 font-mono">
          {[
            { label: "Games", value: owned.length },
            { label: "Steam", value: owned.filter((game) => game.source === "steam").length },
            { label: "PlayStation", value: owned.filter((game) => game.source === "psn").length },
          ].map((stat) => (
            <div key={stat.label}>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                {stat.label}
              </p>
              <p className="text-xl font-bold">{stat.value}</p>
            </div>
          ))}
        </div>
      </div>
      {(libraryQuery.data?.raw_count || libraryQuery.data?.quarantined_count) ? <div className="mb-5 rounded-xl border border-primary/30 bg-primary/10 p-4 text-sm"><p className="font-bold">Improve PlayStation details</p><p className="mt-1 text-muted-foreground">Repair can add catalog art and details or hide unwanted PlayStation entries.</p><Link to="/psn-library-repair" className="mt-2 inline-block font-bold text-primary">Review PSN entries</Link></div> : null}

      <div className="mb-8 flex flex-wrap gap-2 border-b border-border pb-4">
        {tabs.map((item) => (
          <button
            key={item}
            onClick={() => setTab(item)}
            className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${item === tab ? "bg-foreground/5 text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            {item}
          </button>
        ))}
        <label className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          Sort by time
          <select
            value={sortOrder}
            onChange={(event) => setSortOrder(event.target.value as SortOrder)}
            className="rounded-md border border-border bg-surface px-2 py-1 text-foreground"
          >
            <option value="playtime-desc">Most played</option>
            <option value="playtime-asc">Least played</option>
          </select>
        </label>
      </div>

      {libraryQuery.isPending && !libraryQuery.data && (
        <div
          data-testid="library-loading"
          className="rounded-2xl border border-border bg-surface p-6 text-sm text-muted-foreground"
        >
          Loading your library…
        </div>
      )}
      {!(libraryQuery.isPending && !libraryQuery.data) && visible.length === 0 && (
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
          {visible.map((game) => (
            <LibraryCard key={game.id} game={game} />
          ))}
        </div>
      )}
    </AppShell>
  );
}

function LibraryCard({ game }: { game: LibraryOverviewGame }) {
  const contents = (
    <>
      <GameCover
        from="#1d4ed8"
        to="#111827"
        title={game.title}
        image={game.cover_url ?? undefined}
        fallbackImage={
          game.source === "steam" && game.external_id
            ? `https://cdn.cloudflare.steamstatic.com/steam/apps/${game.external_id}/header.jpg`
            : undefined
        }
        compact
        bare
        className="size-16 shrink-0 rounded-lg"
      />
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="truncate font-bold transition-colors group-hover:text-primary">
            {game.title}
          </h4>
          <Chip tone="primary">Owned</Chip>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{game.source === "psn" && game.link_state === "raw" ? "PlayStation title — catalog details can be added later" : "Synced from your connected library"}</p>
      </div>
      <div className="hidden text-right sm:block">
        <p className="label-mono text-muted-foreground">Source</p>
        <p className="text-sm font-bold">{librarySource(game.source)}</p>
      </div>
      <div className="text-right">
        <p className="label-mono text-muted-foreground">Playtime</p>
        <p className="flex items-center justify-end gap-1.5 font-mono text-sm font-bold">
          <Gamepad2 className="size-3.5 text-muted-foreground" />
          {libraryPlaytime(game.playtime_forever)}
        </p>
      </div>
    </>
  );
  const className =
    "hover-lift group grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-5 rounded-xl border border-border bg-surface p-4 hover:border-primary/40 sm:grid-cols-[auto_minmax(0,1fr)_auto_auto]";
  const gameId = game.source === "steam" ? game.external_id : game.detail_game_id;
  return gameId ? (
    <Link
      to="/games/$gameId"
      params={{ gameId }}
      search={{ title: game.title, source: game.source === "steam" ? "steam" : undefined }}
      className={className}
    >
      {contents}
    </Link>
  ) : (
    <div className={className}>{contents}</div>
  );
}
