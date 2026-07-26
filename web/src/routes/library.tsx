import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { GameCover } from "@/components/GameCover";
import { Chip, SectionHeader } from "@/components/ui-bits";
import { PsnLibraryPanel } from "@/features/library/PsnLibraryPanel";
import { SteamLibraryPanel } from "@/features/library/SteamLibraryPanel";
import { getProfileSummary, searchGames, type SavedGame } from "@/lib/api";
import {
  lovableQueryKeys,
  toSavedGameCard,
  type LovableSavedGameCard,
} from "@/lib/lovable-data";

type LibraryTab = "library" | "steam" | "psn";
const libraryTabs: readonly LibraryTab[] = ["library", "steam", "psn"];

export const Route = createFileRoute("/library")({
  validateSearch: (search: Record<string, unknown>) => ({
    tab: libraryTabs.includes(search.tab as LibraryTab)
      ? (search.tab as LibraryTab)
      : "library",
    linked: search.linked === "1" ? "1" : undefined,
    error: typeof search.error === "string" ? search.error : undefined,
  }),
  component: LibraryPage,
});

function SavedGameCover({ game }: { game: LovableSavedGameCard }) {
  const catalogCover = useQuery({
    queryKey: ["library-cover", game.title],
    queryFn: () => searchGames(game.title),
    enabled: !game.imageUrl,
    staleTime: 1000 * 60 * 60,
  });
  const cover =
    game.imageUrl ??
    catalogCover.data?.results[0]?.background_image ??
    "#14b8a6";
  return (
    <GameCover
      from={cover}
      to="#0f172a"
      title={game.title}
      compact
      className="size-16 shrink-0 rounded-lg"
    />
  );
}

function LibraryGameRow({ game }: { game: SavedGame }) {
  const card = toSavedGameCard(game);
  const hours = game.playtime_forever
    ? `${Math.round(game.playtime_forever / 60)}h played`
    : null;
  return (
    <Link
      to="/games/$gameId"
      params={{ gameId: game.id }}
      className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-5 rounded-xl border border-border bg-surface p-4 transition hover:border-primary/50"
    >
      <SavedGameCover game={card} />
      <div className="min-w-0">
        <h4 className="truncate font-bold">{game.title}</h4>
        <p className="truncate text-xs text-muted-foreground">
          {game.notes || hours || "Saved in your library"}
        </p>
      </div>
      <Chip tone="primary">{game.source}</Chip>
    </Link>
  );
}

function SavedGamesLibrary() {
  const query = useQuery({
    queryKey: lovableQueryKeys.profileSummary,
    queryFn: getProfileSummary,
  });
  const block = query.data?.library;
  const stats = block?.data;
  const games = stats?.games ?? [];
  const unauthorized =
    (query.error as { status?: number } | null)?.status === 401;
  const hint = unauthorized
    ? "Sign in to view your library."
    : query.isPending
      ? "Loading library…"
      : block?.status === "ready"
        ? `${stats?.total_games ?? games.length} games synced`
        : block?.message || "Your library is empty.";

  return (
    <>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <p className="text-sm text-muted-foreground">{hint}</p>
        <div className="flex items-center gap-6 font-mono">
          {[
            ["Games", stats?.total_games],
            [
              "Hours",
              stats?.total_playtime_hours === undefined
                ? undefined
                : `${stats.total_playtime_hours}h`,
            ],
            ["Manual", stats?.manual_games],
            ["PSN", stats?.psn_games],
          ].map(([label, value]) => (
            <div key={String(label)}>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                {label}
              </p>
              <p className="text-xl font-bold">{value ?? "—"}</p>
            </div>
          ))}
        </div>
      </div>
      {unauthorized ? (
    <div className="rounded-xl border border-border bg-surface p-6 text-sm text-muted-foreground">
      <p>{hint}</p>
      <Link
        to="/login"
        className="mt-4 inline-block rounded-lg bg-primary px-3 py-2 font-bold text-primary-foreground"
      >
        Sign in
      </Link>
    </div>
  ) : games.length ? (
    <div className="space-y-3">
      {games.map((game) => (
        <LibraryGameRow key={game.id} game={game} />
      ))}
    </div>
  ) : (
    <div className="rounded-xl border border-border bg-surface p-6 text-sm text-muted-foreground">
      <p>{hint}</p>
      <Link
        to="/search"
        className="mt-4 inline-block rounded-lg bg-primary px-3 py-2 font-bold text-primary-foreground"
      >
        Add a game
      </Link>
    </div>
      )}
    </>
  );
}

export function LibraryPage() {
  const { tab, linked, error } = Route.useSearch();

  return (
    <AppShell>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <SectionHeader title="Library" />
      </div>
      <div
        role="tablist"
        aria-label="Library platform"
        className="mb-8 flex w-fit rounded-lg border border-border p-1"
      >
        <Link
          role="tab"
          aria-selected={tab === "library"}
          to="/library"
          search={{ linked, error }}
          className="rounded-md px-3 py-2 text-sm font-bold"
        >
          Library
        </Link>
        <Link
          role="tab"
          aria-selected={tab === "steam"}
          to="/library"
          search={{ tab: "steam", linked, error }}
          className="rounded-md px-3 py-2 text-sm font-bold"
        >
          Steam
        </Link>
        <Link
          role="tab"
          aria-selected={tab === "psn"}
          to="/library"
          search={{ tab: "psn", linked, error }}
          className="rounded-md px-3 py-2 text-sm font-bold"
        >
          PSN
        </Link>
      </div>
      {tab === "library" ? <SavedGamesLibrary /> : null}
      {tab === "steam" ? (
        <SteamLibraryPanel linked={linked} error={error} />
      ) : null}
      {tab === "psn" ? <PsnLibraryPanel /> : null}
    </AppShell>
  );
}
