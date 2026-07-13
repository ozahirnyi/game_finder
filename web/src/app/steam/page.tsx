"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import {
  ApiError,
  RecommendationItem,
  SearchGame,
  SteamAccount,
  SteamGame,
  SteamSocial,
  createSavedGame,
  getSteamAccount,
  getSteamLibrary,
  getSteamLoginUrl,
  getSteamRecommendations,
  getSteamSocial,
  isAuthenticated,
  searchGames,
  syncSteamLibrary,
  unlinkSteamAccount,
} from "@/lib/api";

type RecommendationDetails = Record<string, SearchGame | null>;
type SteamGameIconSource = Pick<SteamGame, "appid" | "name" | "img_icon_url">;

function formatPlaytime(minutes: number) {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.round((minutes / 60) * 10) / 10;
  return `${hours} h`;
}

function recommendationKey(item: RecommendationItem) {
  return `${item.title}-${item.reason}`;
}

function steamIconUrl(game: SteamGameIconSource) {
  if (!game.img_icon_url) {
    return null;
  }
  return `https://media.steampowered.com/steamcommunity/public/images/apps/${game.appid}/${game.img_icon_url}.jpg`;
}

function SteamAvatar({
  src,
  size,
  small = false,
}: {
  src: string | null | undefined;
  size: number;
  small?: boolean;
}) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className={`steam-avatar-placeholder${small ? " small" : ""}`} aria-hidden="true">
        ST
      </div>
    );
  }

  return <Image src={src} alt="" width={size} height={size} onError={() => setFailed(true)} />;
}

function SteamGameIcon({ game }: { game: SteamGameIconSource }) {
  const src = steamIconUrl(game);
  if (!src) {
    return (
      <span className="steam-game-icon placeholder" aria-hidden="true">
        {game.name.slice(0, 2).toUpperCase()}
      </span>
    );
  }
  return <Image className="steam-game-icon" src={src} alt="" width={36} height={36} />;
}

function SteamGameChipList({ games }: { games: SteamGame[] }) {
  if (games.length === 0) {
    return <p>No games available.</p>;
  }

  return (
    <div className="steam-chip-list">
      {games.map((game) => (
        <span className="steam-game-chip" key={game.appid}>
          <SteamGameIcon game={game} />
          {game.name}
        </span>
      ))}
    </div>
  );
}

function SteamPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [steam, setSteam] = useState<SteamAccount | null>(null);
  const [games, setGames] = useState<SteamGame[]>([]);
  const [social, setSocial] = useState<SteamSocial | null>(null);
  const [recommendations, setRecommendations] = useState<RecommendationItem[]>([]);
  const [recommendationDetails, setRecommendationDetails] = useState<RecommendationDetails>({});
  const [loading, setLoading] = useState(true);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [savingRecommendation, setSavingRecommendation] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [visibleGameLimit, setVisibleGameLimit] = useState(5);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const topTwentyGames = useMemo(() => games.slice(0, 20), [games]);
  const visibleGames = useMemo(() => topTwentyGames.slice(0, visibleGameLimit), [topTwentyGames, visibleGameLimit]);
  const callbackMessage = searchParams.get("linked") ? "Steam account linked." : "";
  const callbackError = searchParams.get("error") ?? "";
  const totalPlaytime = useMemo(
    () => games.reduce((sum, game) => sum + (game.playtime_forever || 0), 0),
    [games]
  );
  const bestFriend = social?.friends.find((friend) => friend.library_public);

  const loadLibrary = useCallback(async (active = true) => {
    setLibraryLoading(true);
    setError("");
    try {
      const data = await getSteamLibrary();
      if (active) {
        setSteam(data.steam);
        setGames(data.games);
        setSocial(null);
        setRecommendations([]);
        setRecommendationDetails({});
        setVisibleGameLimit(5);
      }
    } catch (err) {
      if (active) {
        if (err instanceof ApiError && err.status === 401) {
          router.push("/login?message=Your session expired. Please log in again.");
          return;
        }
        setGames([]);
        setSocial(null);
        setRecommendations([]);
        setRecommendationDetails({});
        setError(err instanceof ApiError ? err.message : "Could not load Steam library.");
      }
    } finally {
      if (active) {
        setLibraryLoading(false);
      }
    }
  }, [router]);

  const loadSocial = useCallback(async () => {
    if (!steam?.linked) {
      setError("Connect Steam first.");
      return;
    }
    setSocialLoading(true);
    setError("");
    setMessage("");
    try {
      const data = await getSteamSocial(12);
      setSocial(data);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.push("/login?message=Your session expired. Please log in again.");
        return;
      }
      setSocial(null);
      setError(err instanceof ApiError ? err.message : "Could not load Steam friends.");
    } finally {
      setSocialLoading(false);
    }
  }, [router, steam?.linked]);

  async function syncLibrary() {
    setLibraryLoading(true);
    setError("");
    setMessage("");
    try {
      const data = await syncSteamLibrary();
      setSteam(data.steam);
      setGames(data.games);
      setSocial(null);
      setRecommendations([]);
      setRecommendationDetails({});
      setVisibleGameLimit(5);
      setMessage(
        data.removed
          ? `Steam library refreshed. Removed ${data.removed} previously imported game${data.removed === 1 ? "" : "s"} from Saved games.`
          : "Steam library refreshed."
      );
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.push("/login?message=Your session expired. Please log in again.");
        return;
      }
      setError(err instanceof ApiError ? err.message : "Could not sync Steam library.");
    } finally {
      setLibraryLoading(false);
    }
  }

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push("/login?message=Log in to connect Steam.");
      return;
    }

    let active = true;
    getSteamAccount()
      .then((data) => {
        if (active) {
          setSteam(data);
          if (data.linked) {
            loadLibrary(active);
          }
        }
      })
      .catch((err) => {
        if (active) {
          if (err instanceof ApiError && err.status === 401) {
            router.push("/login?message=Your session expired. Please log in again.");
            return;
          }
          setError(err instanceof ApiError ? err.message : "Could not load Steam account.");
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [loadLibrary, router]);

  async function connectSteam() {
    setConnecting(true);
    setError("");
    setMessage("");
    try {
      const data = await getSteamLoginUrl();
      window.location.href = data.url;
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.push("/login?message=Your session expired. Please log in again.");
        return;
      }
      setError(err instanceof ApiError ? err.message : "Could not start Steam login.");
      setConnecting(false);
    }
  }

  async function unlinkSteam() {
    setLibraryLoading(true);
    setError("");
    setMessage("");
    try {
      const data = await unlinkSteamAccount();
      setSteam(data);
      setGames([]);
      setSocial(null);
      setRecommendations([]);
      setRecommendationDetails({});
      setVisibleGameLimit(5);
      setMessage("Steam account disconnected.");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.push("/login?message=Your session expired. Please log in again.");
        return;
      }
      setError(err instanceof ApiError ? err.message : "Could not disconnect Steam.");
    } finally {
      setLibraryLoading(false);
    }
  }

  async function askSteamAi() {
    if (!steam?.linked) {
      setError("Connect Steam first.");
      return;
    }
    setAiLoading(true);
    setError("");
    setMessage("");
    setRecommendations([]);
    setRecommendationDetails({});
    try {
      const data = await getSteamRecommendations(aiPrompt.trim());
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
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.push("/login?message=Your session expired. Please log in again.");
        return;
      }
      setError(err instanceof ApiError ? err.message : "Could not generate Steam recommendations.");
    } finally {
      setAiLoading(false);
    }
  }

  async function saveRecommendation(item: RecommendationItem, matchedGame?: SearchGame | null) {
    const key = recommendationKey(item);
    const title = matchedGame?.name?.trim() || item.title.trim();
    if (!title) {
      setError("AI returned a recommendation without a title.");
      return;
    }

    const info = [
      item.reason ? `Steam AI reason: ${item.reason}` : null,
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

  return (
    <section className="stack">
      <div className="section-header steam-header">
        <p className="eyebrow">Steam link</p>
        <h1>{steam?.linked ? "Your Steam library" : "Connect your Steam library"}</h1>
        <p>
          {steam?.linked
            ? "Your public Steam playtime is ready for library stats and AI recommendations."
            : "Connect Steam once, then use your public playtime as a signal for better recommendations."}
        </p>
      </div>

      {(message || callbackMessage) && <p className="alert success">{message || callbackMessage}</p>}
      {(error || callbackError) && <p className="alert error">{error || callbackError}</p>}
      {loading && <p className="alert">Loading Steam connection...</p>}

      {!loading && (
        <div className="steam-layout">
          <section className="info-panel steam-panel">
            <div className="steam-account">
              <SteamAvatar src={steam?.avatar} size={72} />
              <div>
                <p className="eyebrow">{steam?.linked ? "Connected account" : "No Steam account connected"}</p>
                <h2>{steam?.persona_name || steam?.steam_id || "Steam is not linked yet"}</h2>
                <p>
                  {steam?.linked
                    ? "Public game details are connected to Game Finder."
                    : "Connect Steam first. If your game details are private, Steam will not expose your library."}
                </p>
              </div>
            </div>
            <div className="steam-stat-grid">
              <div>
                <span>Status</span>
                <strong>{steam?.linked ? "Connected" : "Not linked"}</strong>
              </div>
              <div>
                <span>Games</span>
                <strong>{games.length || "-"}</strong>
              </div>
              <div>
                <span>Playtime</span>
                <strong>{games.length ? formatPlaytime(totalPlaytime) : "-"}</strong>
              </div>
              <div>
                <span>Region</span>
                <strong>{steam?.country_code || "-"}</strong>
              </div>
            </div>
            <div className="actions">
              {steam?.linked ? (
                <>
                  <button type="button" onClick={syncLibrary} disabled={libraryLoading}>
                    {libraryLoading ? "Refreshing..." : "Refresh library"}
                  </button>
                  <button className="secondary" type="button" onClick={unlinkSteam} disabled={libraryLoading}>
                    Disconnect
                  </button>
                </>
              ) : (
                <button type="button" onClick={connectSteam} disabled={connecting}>
                  {connecting ? "Opening Steam..." : "Connect Steam"}
                </button>
              )}
            </div>
          </section>

          <div className="steam-content-grid">
            <div className="steam-primary-column">
          <details className="results-panel steam-ai-panel steam-disclosure">
            <summary className="steam-disclosure-summary">
              <div>
                <p className="eyebrow">AI from Steam</p>
                <h2>{steam?.linked ? "Recommendations from your playtime" : "Unlock playtime recommendations"}</h2>
              </div>
              <div className="steam-disclosure-status">
                <p>{steam?.linked ? (recommendations.length ? `${recommendations.length} ideas` : "Ready to ask") : "Connect Steam first"}</p>
                <span aria-hidden="true">+</span>
              </div>
            </summary>

            <div className="steam-disclosure-body">
              {steam?.linked ? (
              <>
                <div className="steam-ai-form">
                  <label>
                    Extra direction
                    <input
                      value={aiPrompt}
                      onChange={(event) => setAiPrompt(event.target.value)}
                      maxLength={500}
                      placeholder="Optional: recommend something shorter, cozier, harder, or story-heavy..."
                    />
                  </label>
                  <button type="button" onClick={askSteamAi} disabled={aiLoading || libraryLoading}>
                    {aiLoading ? "Thinking..." : "Ask AI from Steam"}
                  </button>
                </div>

                {recommendations.length > 0 && (
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
                )}
              </>
            ) : (
              <div className="steam-ai-preview">
                <p>After connecting Steam, AI can use your most played games as the main preference signal.</p>
                <button type="button" onClick={connectSteam} disabled={connecting}>
                  {connecting ? "Opening Steam..." : "Connect Steam"}
                </button>
              </div>
              )}
            </div>
          </details>

          <details className="results-panel steam-social-panel steam-disclosure">
            <summary className="steam-disclosure-summary">
              <div>
                <p className="eyebrow">Steam friends</p>
                <h2>{social ? "Your social taste map" : "Compare with friends"}</h2>
              </div>
              <div className="steam-disclosure-status">
                <p>
                  {social
                    ? `${social.public_libraries} public / ${social.private_libraries} private`
                    : steam?.linked
                      ? "Ready"
                      : "Connect Steam first"}
                </p>
                <span aria-hidden="true">+</span>
              </div>
            </summary>

            <div className="steam-disclosure-body">
              {steam?.linked ? (
              <>
                <div className="steam-ai-preview">
                  <p>
                    {social
                      ? bestFriend
                        ? `Closest public match: ${bestFriend.persona_name || bestFriend.steam_id} with ${bestFriend.taste_match_percent}% overlap.`
                        : "Friends loaded, but no public game libraries were available."
                      : "Load public Steam friends to see shared games, top friend picks, and taste overlap."}
                  </p>
                  <button type="button" onClick={loadSocial} disabled={socialLoading || libraryLoading}>
                    {socialLoading ? "Loading..." : social ? "Refresh social" : "Load friends"}
                  </button>
                </div>

                {social?.top_friend_games.length ? (
                  <div className="social-summary-grid">
                    {social.top_friend_games.slice(0, 6).map((game) => (
                      <article className="social-mini-card" key={game.appid}>
                        <div className="social-mini-header">
                          <SteamGameIcon game={game} />
                          <div>
                            <span>{game.friends} friends</span>
                            <h3>{game.name}</h3>
                          </div>
                        </div>
                        <p>{formatPlaytime(game.total_playtime_forever)} combined</p>
                      </article>
                    ))}
                  </div>
                ) : null}

                {social?.friends.length ? (
                  <div className="friend-list">
                    {social.friends.map((friend) => (
                      <article className="friend-card" key={friend.steam_id}>
                        <div className="friend-header">
                          <SteamAvatar src={friend.avatar} size={48} small />
                          <div>
                            <h3>{friend.persona_name || friend.steam_id}</h3>
                            <p>
                              {friend.library_public
                                ? `${friend.taste_match_percent}% match | ${friend.common_games_count} shared games`
                                : "Library private or unavailable"}
                            </p>
                          </div>
                        </div>

                        {friend.library_public ? (
                          <>
                            <div className="friend-section">
                              <span>Shared games</span>
                              {friend.common_games.length ? (
                                <SteamGameChipList games={friend.common_games} />
                              ) : (
                                <p>No shared games found in public libraries.</p>
                              )}
                            </div>
                            <div className="friend-section">
                              <span>Friend top games</span>
                              {friend.top_games.length ? (
                                <div className="steam-chip-list">
                                  {friend.top_games.map((game) => (
                                    <span className="steam-game-chip" key={game.appid}>
                                      <SteamGameIcon game={game} />
                                      {game.name} ({formatPlaytime(game.playtime_forever)})
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <p>No playtime data available.</p>
                              )}
                            </div>
                          </>
                        ) : (
                          <div className="friend-section">
                            <span>Privacy</span>
                            <p>Steam did not expose owned games for this friend.</p>
                          </div>
                        )}
                      </article>
                    ))}
                  </div>
                ) : null}
              </>
            ) : (
              <div className="steam-ai-preview">
                <p>Connect Steam to compare your public library with public friend libraries.</p>
                <button type="button" onClick={connectSteam} disabled={connecting}>
                  {connecting ? "Opening Steam..." : "Connect Steam"}
                </button>
              </div>
              )}
            </div>
          </details>
            </div>

            <aside className="steam-sidebar">
          <section className="results-panel steam-library-panel">
            <div className="results-heading">
              <div>
                <p className="eyebrow">Library analysis</p>
                <h2>Most played games</h2>
              </div>
              <p>
                {games.length
                  ? `Showing ${visibleGames.length} of ${Math.min(games.length, 20)} top games`
                  : "Waiting for library"}
              </p>
            </div>

            {libraryLoading && <p className="alert">Reading Steam library...</p>}
            {!libraryLoading && steam?.linked && games.length === 0 && (
              <div className="empty-state compact-empty">
                <p>No Steam games loaded yet. Your Steam game details may be private.</p>
                <button className="secondary fit" type="button" onClick={syncLibrary}>
                  Refresh library
                </button>
              </div>
            )}
            {!steam?.linked && (
              <div className="empty-state steam-connect-empty">
                <p>Connect Steam to show your most played games here.</p>
                <button type="button" onClick={connectSteam} disabled={connecting}>
                  {connecting ? "Opening Steam..." : "Connect Steam"}
                </button>
              </div>
            )}

            {visibleGames.length > 0 && (
              <>
                <div className="steam-game-list">
                  {visibleGames.map((game, index) => (
                    <article className="steam-game-row" key={game.appid}>
                      <span className="steam-rank">{index + 1}</span>
                      <SteamGameIcon game={game} />
                      <div>
                        <h3>{game.name}</h3>
                        <p>
                          {formatPlaytime(game.playtime_forever)}
                          {game.playtime_2weeks ? ` | ${formatPlaytime(game.playtime_2weeks)} in last 2 weeks` : ""}
                        </p>
                      </div>
                    </article>
                  ))}
                </div>

                <div className="steam-library-footer">
                  {visibleGameLimit < Math.min(games.length, 20) ? (
                    <button className="secondary" type="button" onClick={() => setVisibleGameLimit(20)}>
                      Show more
                    </button>
                  ) : games.length > 5 ? (
                    <button className="secondary" type="button" onClick={() => setVisibleGameLimit(5)}>
                      Show less
                    </button>
                  ) : null}
                </div>
              </>
            )}
          </section>
            </aside>
          </div>

        </div>
      )}
    </section>
  );
}

export default function SteamPage() {
  return (
    <Suspense fallback={null}>
      <SteamPageContent />
    </Suspense>
  );
}
