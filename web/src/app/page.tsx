"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import {
  ApiError,
  RecommendationItem,
  SearchGame,
  createSavedGame,
  getRecommendations,
  getTrendingGames,
  getUpcomingGames,
  isAuthenticated,
  searchGames,
} from "@/lib/api";

type SearchMode = "title" | "ai";
type RecommendationDetails = Record<string, SearchGame | null>;

export default function Home() {
  const router = useRouter();
  const [mode, setMode] = useState<SearchMode>("title");
  const [query, setQuery] = useState("");
  const [games, setGames] = useState<SearchGame[]>([]);
  const [recommendations, setRecommendations] = useState<RecommendationItem[]>([]);
  const [recommendationDetails, setRecommendationDetails] = useState<RecommendationDetails>({});
  const [loading, setLoading] = useState(false);
  const [savingRecommendation, setSavingRecommendation] = useState("");
  const [trendingGames, setTrendingGames] = useState<SearchGame[]>([]);
  const [trendingLoading, setTrendingLoading] = useState(true);
  const [trendingError, setTrendingError] = useState("");
  const [upcomingGames, setUpcomingGames] = useState<SearchGame[]>([]);
  const [upcomingLoading, setUpcomingLoading] = useState(true);
  const [savingWatch, setSavingWatch] = useState("");
  const [upcomingError, setUpcomingError] = useState("");
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const isAiMode = mode === "ai";

  useEffect(() => {
    let active = true;

    getTrendingGames(8)
      .then((data) => {
        if (active) {
          setTrendingGames(data.results.filter((game) => game.id && game.name).slice(0, 8));
        }
      })
      .catch((err) => {
        if (active) {
          setTrendingError(err instanceof ApiError ? err.message : "Could not load trending games.");
        }
      })
      .finally(() => {
        if (active) {
          setTrendingLoading(false);
        }
      });

    getUpcomingGames(8)
      .then((data) => {
        if (active) {
          setUpcomingGames(data.results.filter((game) => game.id && game.name).slice(0, 8));
        }
      })
      .catch((err) => {
        if (active) {
          setUpcomingError(err instanceof ApiError ? err.message : "Could not load upcoming games.");
        }
      })
      .finally(() => {
        if (active) {
          setUpcomingLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = query.trim();
    setError("");
    setMessage("");
    setSearched(true);
    setGames([]);
    setRecommendations([]);
    setRecommendationDetails({});

    if (!trimmed) {
      setError(isAiMode ? "Describe the kind of game you want." : "Type a game name to search.");
      return;
    }

    setLoading(true);
    try {
      if (isAiMode) {
        const data = await getRecommendations(trimmed);
        setRecommendations(data.recommendations);
        const detailEntries = await Promise.all(
          data.recommendations.map(async (item) => {
            try {
              const searchResult = await searchGames(item.title);
              const normalizedTitle = item.title.trim().toLowerCase();
              const matchedGame =
                searchResult.results.find((game) => game.name?.trim().toLowerCase() === normalizedTitle) ??
                searchResult.results[0] ??
                null;
              return [recommendationKey(item), matchedGame] as const;
            } catch {
              return [recommendationKey(item), null] as const;
            }
          })
        );
        setRecommendationDetails(Object.fromEntries(detailEntries));
      } else {
        const data = await searchGames(trimmed);
        setGames(data.results);
      }
    } catch (err) {
      setGames([]);
      setRecommendations([]);
      setError(err instanceof ApiError ? err.message : "Search failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function pickSuggestion(value: string) {
    setQuery(value);
    setError("");
    setMessage("");
  }

  function switchMode(nextMode: SearchMode) {
    setMode(nextMode);
    setQuery("");
    setGames([]);
    setRecommendations([]);
    setRecommendationDetails({});
    setSearched(false);
    setError("");
    setMessage("");
  }

  function recommendationKey(item: RecommendationItem) {
    return `${item.title}-${item.reason}`;
  }

  async function saveRecommendation(item: RecommendationItem, matchedGame?: SearchGame | null) {
    const key = recommendationKey(item);
    const title = matchedGame?.name?.trim() || item.title.trim();
    if (!title) {
      setError("AI returned a recommendation without a title.");
      return;
    }
    if (!isAuthenticated()) {
      router.push("/login?message=Log in to save AI recommendations.");
      return;
    }

    const info = [
      item.reason ? `AI reason: ${item.reason}` : null,
      matchedGame?.released ? `Released: ${matchedGame.released}` : null,
      item.tags.length ? `Tags: ${item.tags.join(", ")}` : null,
    ]
      .filter(Boolean)
      .join(" | ")
      .slice(0, 500);

    setSavingRecommendation(key);
    setError("");
    setMessage("");
    try {
      await createSavedGame(title, info);
      setMessage(`${title} saved to your library.`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.push("/login?message=Your session expired. Please log in again.");
        return;
      }
      setError(err instanceof ApiError ? err.message : "Could not save this recommendation.");
    } finally {
      setSavingRecommendation("");
    }
  }

  async function saveWatchGame(game: SearchGame, kind: "popular" | "upcoming") {
    const title = game.name?.trim();
    if (!title) {
      return;
    }
    if (!isAuthenticated()) {
      router.push("/login?message=Log in to save game alerts.");
      return;
    }

    const info = [
      kind === "upcoming" ? "Release alert" : "Popular now",
      game.released ? `${kind === "upcoming" ? "Expected release" : "Released"}: ${game.released}` : null,
      game.id ? `RAWG ID: ${game.id}` : null,
    ]
      .filter(Boolean)
      .join(" | ")
      .slice(0, 500);

    setSavingWatch(`${kind}-${game.id ?? title}`);
    setError("");
    setMessage("");
    try {
      await createSavedGame(title, info);
      setMessage(`${title} saved to your alerts.`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.push("/login?message=Your session expired. Please log in again.");
        return;
      }
      setError(err instanceof ApiError ? err.message : "Could not save this game.");
    } finally {
      setSavingWatch("");
    }
  }

  return (
    <section className="home-shell">
      <div className="hero-panel">
        <div className="neon-frame" aria-hidden="true" />
        <div className="section-header hero-copy">
          <p className="eyebrow">Game discovery, without the noise</p>
          <h1>Find your next game.</h1>
          <p>Search by title, describe a mood, or browse a few current picks.</p>
        </div>

        <div className="search-mode-toggle" aria-label="Search mode">
          <button
            type="button"
            className={mode === "title" ? "active" : ""}
            aria-pressed={mode === "title"}
            onClick={() => switchMode("title")}
          >
            Title search
          </button>
          <button
            type="button"
            className={mode === "ai" ? "active" : ""}
            aria-pressed={mode === "ai"}
            onClick={() => switchMode("ai")}
          >
            AI search
          </button>
        </div>

        <form className="search-form hero-search" onSubmit={onSubmit}>
          <label className="sr-only" htmlFor="query">
            {isAiMode ? "Game prompt" : "Game title"}
          </label>
          <input
            id="query"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={
              isAiMode
                ? "Try: I want a slow dark RPG with choices and atmosphere..."
                : "Try: Hades, Portal, Disco Elysium..."
            }
          />
          <button type="submit" disabled={loading}>
            {loading ? "Searching" : isAiMode ? "Ask AI" : "Search"}
          </button>
        </form>

        <div className={`prompt-chips ${isAiMode ? "prompt-chips-ai" : ""}`} aria-label="Search suggestions">
          {(isAiMode
            ? [
                "I want a dark RPG with meaningful choices",
                "Something cozy for a quiet weekend",
                "A clever strategy game that is not too stressful",
                "A story-rich mystery with strong atmosphere",
              ]
            : ["Hades", "Portal 2", "Disco Elysium", "Stardew Valley", "Cyberpunk 2077"]
          ).map((suggestion) => (
            <button className="chip-button" type="button" key={suggestion} onClick={() => pickSuggestion(suggestion)}>
              {suggestion}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="alert error">{error}</p>}
      {message && <p className="alert success">{message}</p>}
      {!error && searched && !loading && !isAiMode && games.length === 0 && <p className="alert">No games found.</p>}
      {!error && searched && !loading && isAiMode && recommendations.length === 0 && (
        <p className="alert">AI did not return recommendations for this prompt.</p>
      )}

      {!isAiMode && searched && !loading && games.length > 0 && (
        <section className="results-panel">
          <div className="results-heading">
            <h2>Matches</h2>
            <p>{games.length} results</p>
          </div>
          <div className="game-grid">
            {games.map((game) => (
              <article className="game-card" key={`${game.id}-${game.name}`}>
                <div className="game-image">
                  {game.background_image ? (
                    <Image src={game.background_image} alt="" fill sizes="(max-width: 760px) 100vw, 33vw" />
                  ) : (
                    <span>No image</span>
                  )}
                </div>
                <div className="card-body">
                  <h2>{game.name ?? "Untitled game"}</h2>
                  <p>{game.released ? `Released ${game.released}` : "Release date unknown"}</p>
                  {game.id ? (
                    <Link className="button secondary" href={`/games/${game.id}`}>
                      Open details
                    </Link>
                  ) : (
                    <span className="muted">Details unavailable</span>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {isAiMode && searched && !loading && recommendations.length > 0 && (
        <section className="results-panel">
          <div className="results-heading">
            <h2>AI recommendations</h2>
            <p>{recommendations.length} ideas</p>
          </div>
          <div className="recommendation-grid">
            {recommendations.map((item) => {
              const key = recommendationKey(item);
              const matchedGame = recommendationDetails[key];
              const isSaving = savingRecommendation === key;

              return (
                <article className="recommendation-card" key={key}>
                  <div className="game-image recommendation-image">
                    {matchedGame?.background_image ? (
                      <Image
                        src={matchedGame.background_image}
                        alt=""
                        fill
                        sizes="(max-width: 760px) 100vw, 33vw"
                      />
                    ) : (
                      <span>No image</span>
                    )}
                  </div>
                  <h2>{matchedGame?.name ?? item.title}</h2>
                  <p>{matchedGame?.released ? `Released ${matchedGame.released}` : "Release date unknown"}</p>
                  <p>{item.reason}</p>
                  {item.tags.length > 0 && (
                    <div className="tag-row">
                      {item.tags.map((tag) => (
                        <span key={tag}>{tag}</span>
                      ))}
                    </div>
                  )}
                  <div className="recommendation-actions">
                    {matchedGame?.id ? (
                      <Link className="button secondary" href={`/games/${matchedGame.id}`}>
                        Open details
                      </Link>
                    ) : (
                      <span className="muted">Details unavailable</span>
                    )}
                    <button
                      type="button"
                      onClick={() => saveRecommendation(item, matchedGame)}
                      disabled={isSaving}
                    >
                      {isSaving ? "Saving..." : "Save game"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {!searched && (
        <div className="home-discovery home-two-column">
          <section className="results-panel home-section-panel" id="popular">
            <div className="results-heading">
              <div>
                <p className="eyebrow">Popular now</p>
                <h2>Current picks</h2>
              </div>
              <p>{trendingLoading ? "Loading" : `${trendingGames.length} games`}</p>
            </div>

            {trendingError && <p className="alert error">{trendingError}</p>}
            {!trendingError && trendingLoading && <p className="alert">Loading popular games...</p>}
            {!trendingError && !trendingLoading && trendingGames.length === 0 && (
              <p className="alert">No popular games loaded yet.</p>
            )}

            {trendingGames.length > 0 && (
              <div className="compact-game-list">
                {trendingGames.slice(0, 6).map((game) => {
                  const key = String(game.id ?? game.name);
                  const isSaving = savingWatch === `popular-${game.id ?? game.name}`;

                  return (
                    <article className="compact-game-row" key={key}>
                      <div className="compact-game-image">
                        {game.background_image ? (
                          <Image src={game.background_image} alt="" fill sizes="96px" />
                        ) : (
                          <span>No image</span>
                        )}
                      </div>
                      <div>
                        <h3>{game.name}</h3>
                        <p>{game.released ? `Released ${game.released}` : "Release date unknown"}</p>
                      </div>
                      <div className="compact-actions">
                        {game.id ? (
                          <Link className="button secondary" href={`/games/${game.id}`}>
                            Details
                          </Link>
                        ) : null}
                        <button type="button" onClick={() => saveWatchGame(game, "popular")} disabled={isSaving}>
                          {isSaving ? "Saving..." : "Save"}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <section className="results-panel home-section-panel">
            <div className="results-heading">
              <div>
                <p className="eyebrow">Upcoming releases</p>
                <h2>Worth watching</h2>
              </div>
              <p>{upcomingLoading ? "Loading" : `${upcomingGames.length} games`}</p>
            </div>

            {upcomingError && <p className="alert error">{upcomingError}</p>}
            {!upcomingError && upcomingLoading && <p className="alert">Loading upcoming releases...</p>}
            {!upcomingError && !upcomingLoading && upcomingGames.length === 0 && (
              <p className="alert">No upcoming games loaded yet.</p>
            )}

            {upcomingGames.length > 0 && (
              <div className="compact-game-list">
                {upcomingGames.slice(0, 6).map((game) => {
                  const key = String(game.id ?? game.name);
                  const isSaving = savingWatch === `upcoming-${game.id ?? game.name}`;

                  return (
                    <article className="compact-game-row" key={key}>
                      <div className="compact-game-image">
                        {game.background_image ? (
                          <Image src={game.background_image} alt="" fill sizes="96px" />
                        ) : (
                          <span>No image</span>
                        )}
                      </div>
                      <div>
                        <h3>{game.name}</h3>
                        <p>{game.released ? `Expected ${game.released}` : "Release date unknown"}</p>
                      </div>
                      <div className="compact-actions">
                        {game.id ? (
                          <Link className="button secondary" href={`/games/${game.id}`}>
                            Details
                          </Link>
                        ) : null}
                        <button type="button" onClick={() => saveWatchGame(game, "upcoming")} disabled={isSaving}>
                          {isSaving ? "Saving..." : "Notify me"}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}
    </section>
  );
}
