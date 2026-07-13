"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import {
  ApiError,
  SavedGame,
  SearchGame,
  deleteSavedGame,
  isAuthenticated,
  listSavedGames,
  searchGames,
  updateSavedGame,
} from "@/lib/api";

async function loadSavedGameImages(savedGames: SavedGame[], limit: number) {
  const entries = await Promise.all(
    savedGames.slice(0, limit).map(async (game) => {
      try {
        const result = await searchGames(game.title);
        return [game.id, result.results[0] ?? null] as const;
      } catch {
        return [game.id, null] as const;
      }
    })
  );
  return Object.fromEntries(entries) as Record<string, SearchGame | null>;
}

export default function FavoritesPage() {
  const router = useRouter();
  const [games, setGames] = useState<SavedGame[]>([]);
  const [imageMap, setImageMap] = useState<Record<string, SearchGame | null>>({});
  const [expandedId, setExpandedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push("/login?message=Log in to open your saved games.");
      return;
    }

    let active = true;
    listSavedGames()
      .then((data) => {
        if (active) {
          setGames(data);
          loadSavedGameImages(data, 24).then((images) => {
            if (active) {
              setImageMap(images);
            }
          });
        }
      })
      .catch((err) => {
        if (active) {
          if (err instanceof ApiError && err.status === 401) {
            router.push("/login?message=Your session expired. Please log in again.");
            return;
          }
          setError(err instanceof ApiError ? err.message : "Could not load your saved games.");
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
  }, [router]);

  async function removeGame(id: string) {
    setSavingId(id);
    setError("");
    setMessage("");
    try {
      await deleteSavedGame(id);
      setGames((current) => current.filter((game) => game.id !== id));
      setMessage("Removed from your library.");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.push("/login?message=Your session expired. Please log in again.");
        return;
      }
      setError(err instanceof ApiError ? err.message : "Could not remove this game.");
    } finally {
      setSavingId("");
    }
  }

  async function saveEdit(event: FormEvent<HTMLFormElement>, game: SavedGame) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const notes = String(formData.get("notes") ?? "").trim();

    setSavingId(game.id);
    setError("");
    setMessage("");
    try {
      const updated = await updateSavedGame(game.id, notes);
      setGames((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setMessage("Saved changes.");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.push("/login?message=Your session expired. Please log in again.");
        return;
      }
      setError(err instanceof ApiError ? err.message : "Could not save changes.");
    } finally {
      setSavingId("");
    }
  }

  function toggleExpanded(id: string) {
    setExpandedId((current) => (current === id ? "" : id));
  }

  return (
    <section className="stack">
      <div className="section-header">
        <p className="eyebrow">Your library</p>
        <h1>Saved games</h1>
        <p>Keep the games you want to revisit, compare, or play later.</p>
      </div>

      {message && <p className="alert success">{message}</p>}
      {error && <p className="alert error">{error}</p>}
      {loading && <p className="alert">Loading your library...</p>}
      {!loading && games.length === 0 && (
        <div className="empty-state">
          <p>Your library is empty for now.</p>
          <Link className="button secondary fit" href="/">
            Find games
          </Link>
        </div>
      )}

      <div className="favorites-list">
        {games.map((game) => {
          const matchedGame = imageMap[game.id];
          return (
            <form
              className={`favorite-item ${expandedId === game.id ? "expanded" : ""}`}
              key={game.id}
              onSubmit={(event) => saveEdit(event, game)}
            >
              <button
                className="saved-thumb"
                type="button"
                aria-label={`Open saved info for ${game.title}`}
                onClick={(event) => {
                  event.stopPropagation();
                  toggleExpanded(game.id);
                }}
              >
                {matchedGame?.background_image ? (
                  <Image src={matchedGame.background_image} alt="" fill sizes="72px" />
                ) : (
                  <span>{game.title.slice(0, 2).toUpperCase()}</span>
                )}
              </button>
              <button
                className="favorite-title"
                type="button"
                aria-expanded={expandedId === game.id}
                onClick={(event) => {
                  event.stopPropagation();
                  toggleExpanded(game.id);
                }}
              >
                <span>Title</span>
                <strong>{game.title}</strong>
              </button>
              <label onClick={(event) => event.stopPropagation()}>
                Notes
                <input
                  name="notes"
                  defaultValue={game.notes ?? ""}
                  maxLength={255}
                  placeholder="Write your own note..."
                />
              </label>
              <div className="favorite-actions" onClick={(event) => event.stopPropagation()}>
                <button type="submit" disabled={savingId === game.id}>
                  Save
                </button>
                <button
                  className="danger"
                  type="button"
                  disabled={savingId === game.id}
                  onClick={() => removeGame(game.id)}
                >
                  Delete
                </button>
              </div>
              {expandedId === game.id && (
                <div className="favorite-expanded">
                  <div>
                    <p className="eyebrow">Game info</p>
                    <p>{game.info || "No game info saved yet."}</p>
                  </div>
                  <div className="meta-row">
                    <span>Saved {new Date(game.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              )}
            </form>
          );
        })}
      </div>
    </section>
  );
}
