import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { AppShell } from "@/components/AppShell";
import { GameCover } from "@/components/GameCover";
import { StatePanel } from "@/components/ui";
import { SectionHeader } from "@/components/ui-bits";
import { AiRecommendationSearch } from "@/features/discovery/AiRecommendationSearch";
import { searchGames, type SearchGame } from "@/lib/api";

type SearchParams = { q?: string };

export const Route = createFileRoute("/search")({
  validateSearch: (search: Record<string, unknown>): SearchParams => ({
    q:
      typeof search.q === "string" && search.q.trim()
        ? search.q.trim()
        : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Search — GameFinder" },
      {
        name: "description",
        content: "Search games by title or ask AI for personalized picks.",
      },
    ],
  }),
  component: SearchPage,
});

function SearchPage() {
  const { q } = Route.useSearch();
  const navigate = Route.useNavigate();
  const [input, setInput] = useState(q ?? "");
  const [state, setState] = useState<{
    status: "idle" | "loading" | "error" | "success";
    games: SearchGame[];
    message?: string;
  }>({ status: q ? "loading" : "idle", games: [] });

  useEffect(() => {
    setInput(q ?? "");
    if (!q) {
      setState({ status: "idle", games: [] });
      return;
    }

    let active = true;
    setState({ status: "loading", games: [] });
    void searchGames(q).then(
      ({ results }) => {
        if (active) setState({ status: "success", games: results });
      },
      () => {
        if (active) {
          setState({
            status: "error",
            games: [],
            message: "Catalog search is unavailable.",
          });
        }
      },
    );
    return () => {
      active = false;
    };
  }, [q]);

  function submit(event: FormEvent) {
    event.preventDefault();
    const next = input.trim();
    void navigate({ to: "/search", search: next ? { q: next } : {} });
  }

  return (
    <AppShell>
      <AiRecommendationSearch />
      <SectionHeader title="Search the catalog" hint="Search by game title." />
      <form onSubmit={submit} className="mb-6 flex gap-3">
        <label className="sr-only" htmlFor="catalog-search">
          Game title
        </label>
        <input
          id="catalog-search"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          className="flex-1 rounded-xl border border-border bg-surface px-4 py-3"
        />
        <button
          type="submit"
          className="rounded-xl bg-primary px-5 font-bold text-primary-foreground"
        >
          Search
        </button>
      </form>

      {state.status === "loading" ? (
        <StatePanel kind="loading" title="Searching games" />
      ) : null}
      {state.status === "error" ? (
        <StatePanel
          kind="error"
          title="Could not search games"
          detail={state.message}
        />
      ) : null}
      {state.status === "success" && state.games.length === 0 ? (
        <StatePanel kind="empty" title="No games found" />
      ) : null}
      {state.status === "success" && state.games.length > 0 ? (
        <div className="grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-4">
          {state.games.map((game) =>
            game.id ? (
              <Link
                key={game.id}
                to="/games/$gameId"
                params={{ gameId: String(game.id) }}
                aria-label={`View ${game.name ?? "game"}`}
              >
                <GameCover
                  title={game.name ?? "Untitled game"}
                  src={game.background_image}
                  className="aspect-[3/4] w-full"
                />
                <h2 className="mt-3 font-bold">
                  {game.name ?? "Untitled game"}
                </h2>
              </Link>
            ) : (
              <article key={game.steam_appid ?? game.name}>
                <GameCover
                  title={game.name ?? "Untitled game"}
                  src={game.background_image}
                  className="aspect-[3/4] w-full"
                />
                <h2 className="mt-3 font-bold">
                  {game.name ?? "Untitled game"}
                </h2>
                {game.url ? (
                  <a href={game.url} target="_blank" rel="noreferrer">
                    View on Steam
                  </a>
                ) : null}
              </article>
            ),
          )}
        </div>
      ) : null}
    </AppShell>
  );
}
