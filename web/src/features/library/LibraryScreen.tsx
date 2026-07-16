"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { Button, Panel, StatePanel } from "@/components/ui";
import { SavedGame, createSavedGame, deleteSavedGame, isAuthenticated, listSavedGames } from "@/lib/api";

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function LibraryScreen() {
  const authenticated = isAuthenticated();
  const [games, setGames] = useState<SavedGame[]>([]);
  const [loading, setLoading] = useState(authenticated);
  const [initialLoadError, setInitialLoadError] = useState("");
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [removingId, setRemovingId] = useState("");
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    if (!authenticated) return;

    let active = true;
    listSavedGames()
      .then((savedGames) => {
        if (active) {
          setGames(savedGames);
          setInitialLoadError("");
        }
      })
      .catch((reason) => active && setInitialLoadError(errorMessage(reason, "Could not load your library.")))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [authenticated, loadAttempt]);

  function retryLoad() {
    setInitialLoadError("");
    setLoading(true);
    setLoadAttempt((attempt) => attempt + 1);
  }

  async function addGame(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const title = String(new FormData(form).get("title") ?? "").trim();
    if (!title) {
      return;
    }

    setCreating(true);
    setError("");
    try {
      const saved = await createSavedGame(title);
      setGames((current) => [saved, ...current]);
      form.reset();
    } catch (reason) {
      setError(errorMessage(reason, "Could not add this game."));
    } finally {
      setCreating(false);
    }
  }

  async function removeGame(game: SavedGame) {
    setRemovingId(game.id);
    setError("");
    try {
      await deleteSavedGame(game.id);
      setGames((current) => current.filter((item) => item.id !== game.id));
    } catch (reason) {
      setError(errorMessage(reason, "Could not remove this game."));
    } finally {
      setRemovingId("");
    }
  }

  if (!authenticated) {
    return <StatePanel kind="unauthenticated" title="Sign in to view your library" detail="Your saved games are available after you sign in." />;
  }

  if (loading) {
    return <StatePanel kind="loading" title="Loading your library" />;
  }

  if (initialLoadError) {
    return <StatePanel kind="error" title="Could not load your library" detail={initialLoadError} action={{ label: "Retry", onClick: retryLoad }} />;
  }

  return (
    <main className="stack">
      <header className="section-header">
        <p className="eyebrow">Your library</p>
        <h1>Saved games</h1>
        <p>Keep a simple, personal list of the games you want to revisit.</p>
      </header>
      {error ? <p className="alert error" role="alert">{error}</p> : null}
      <Panel>
        <form className="stack" onSubmit={addGame}>
          <label>
            Game title
            <input name="title" required placeholder="Add a game to your library" />
          </label>
          <Button type="submit" disabled={creating}>{creating ? "Adding…" : "Add game"}</Button>
        </form>
      </Panel>
      {games.length === 0 ? (
        <StatePanel kind="empty" title="Your library is empty" detail="Add a game above to start your library." />
      ) : (
        <div className="stack">
          {games.map((game) => (
            <Panel as="article" key={game.id} className="stack">
              <div className="section-header">
                <h2><Link href={`/favorites/${game.id}`}>{game.title}</Link></h2>
                {game.notes ? <p>{game.notes}</p> : null}
              </div>
              <Button variant="quiet" aria-label={`Remove ${game.title}`} disabled={removingId === game.id} onClick={() => removeGame(game)}>
                {removingId === game.id ? "Removing…" : "Remove"}
              </Button>
            </Panel>
          ))}
        </div>
      )}
    </main>
  );
}
