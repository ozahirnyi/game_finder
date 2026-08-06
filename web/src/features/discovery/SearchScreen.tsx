"use client";

import { Link } from "@tanstack/react-router";
import { FormEvent, useEffect, useState } from "react";
import { GameCover } from "@/components/GameCover";
import { StatePanel } from "@/components/ui";
import { searchGames, type SearchGame } from "@/lib/api";

type RemoteState<T> =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; data: T };

export function SearchScreen({
  initialQuery = "",
  onQueryChange,
}: {
  initialQuery?: string;
  onQueryChange?: (query: string) => void;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [requestedQuery, setRequestedQuery] = useState(initialQuery);
  const [retry, setRetry] = useState(0);
  const [results, setResults] = useState<RemoteState<SearchGame[]> | null>(
    initialQuery ? { status: "loading" } : null,
  );
  useEffect(() => {
    if (!requestedQuery.trim()) return;
    let active = true;
    void searchGames(requestedQuery.trim())
      .then(
        (data) =>
          active && setResults({ status: "success", data: data.results }),
      )
      .catch(
        () =>
          active &&
          setResults({
            status: "error",
            message: "Search is unavailable. Please try again.",
          }),
      );
    return () => {
      active = false;
    };
  }, [requestedQuery, retry]);
  function submit(event: FormEvent) {
    event.preventDefault();
    const next = query.trim();
    if (next) {
      setResults({ status: "loading" });
      setRequestedQuery(next);
      onQueryChange?.(next);
    }
  }
  return (
    <div className="stack">
      <header className="section-header">
        <p className="eyebrow">Explore the catalog</p>
        <h1>Search</h1>
      </header>
      <form onSubmit={submit} className="search-form">
        <label htmlFor="game-search">Game title</label>
        <input
          id="game-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <button>Search</button>
      </form>
      <div>
        {["Roguelike", "Co-op", "RPG"].map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            onClick={() => {
              setQuery(suggestion);
              setRequestedQuery(suggestion);
              setResults({ status: "loading" });
              onQueryChange?.(suggestion);
            }}
          >
            {suggestion}
          </button>
        ))}
      </div>
      {results?.status === "loading" ? (
        <StatePanel kind="loading" title="Searching games" />
      ) : null}
      {results?.status === "error" ? (
        <StatePanel
          kind="error"
          title="Could not search games"
          detail={results.message}
          action={{
            label: "Retry",
            onClick: () => {
              setResults({ status: "loading" });
              setRetry((value) => value + 1);
            },
          }}
        />
      ) : null}
      {results?.status === "success" && !results.data.length ? (
        <StatePanel kind="empty" title={`No games match “${requestedQuery}”`} />
      ) : null}
      {results?.status === "success" && results.data.length ? (
        <div className="game-grid">
          {results.data.map((game) => (
            <article
              className="game-card"
              key={game.id ?? game.steam_appid ?? game.name}
            >
              <GameCover
                title={game.name ?? "Game"}
                src={game.background_image}
              />
              <h2>{game.name ?? "Untitled game"}</h2>
              <p>{game.released ?? "Release date unknown"}</p>
              {game.source === "steam" && game.url ? (
                <a href={game.url} target="_blank" rel="noreferrer">
                  View on Steam
                </a>
              ) : game.id ? (
                <Link to="/games/$gameId" params={{ gameId: String(game.id) }}>
                  View details
                </Link>
              ) : null}
            </article>
          ))}
        </div>
      ) : null}
    </div>
  );
}
