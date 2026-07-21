"use client";

import { Link, useNavigate } from "@tanstack/react-router";
import { FormEvent, useEffect, useState } from "react";
import { Button, Panel, StatePanel } from "@/components/ui";
import {
  SavedGame,
  deleteSavedGame,
  getSavedGame,
  isAuthenticated,
  updateSavedGame,
} from "@/lib/api";

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function SavedGameDetailScreen({ id }: { id: string }) {
  const navigate = useNavigate();
  const authenticated = isAuthenticated();
  const [game, setGame] = useState<SavedGame | null>(null);
  const [loading, setLoading] = useState(authenticated);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!authenticated) return;
    let active = true;
    getSavedGame(id)
      .then((savedGame) => active && setGame(savedGame))
      .catch(
        (reason) =>
          active &&
          setError(errorMessage(reason, "Could not load this saved game.")),
      )
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [authenticated, id]);

  async function saveNotes(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!game) return;
    const notes = String(new FormData(event.currentTarget).get("notes") ?? "");
    setSaving(true);
    setError("");
    try {
      setGame(await updateSavedGame(game.id, notes));
    } catch (reason) {
      setError(errorMessage(reason, "Could not save notes."));
    } finally {
      setSaving(false);
    }
  }

  async function removeGame() {
    if (!game) return;
    setDeleting(true);
    setError("");
    try {
      await deleteSavedGame(game.id);
      await navigate({ to: "/library" });
    } catch (reason) {
      setError(errorMessage(reason, "Could not remove this game."));
      setDeleting(false);
    }
  }

  if (!authenticated)
    return (
      <StatePanel kind="unauthenticated" title="Sign in to view saved games" />
    );
  if (loading) return <StatePanel kind="loading" title="Loading saved game" />;
  if (!game)
    return (
      <StatePanel
        kind="error"
        title="Saved game unavailable"
        detail={error || "This saved game could not be found."}
      />
    );

  return (
    <main className="stack">
      <Link to="/library">Back to library</Link>
      <header className="section-header">
        <p className="eyebrow">Saved game</p>
        <h1>{game.title}</h1>
        {game.info ? <p>{game.info}</p> : null}
      </header>
      {error ? (
        <p className="alert error" role="alert">
          {error}
        </p>
      ) : null}
      <Panel>
        <form className="stack" onSubmit={saveNotes}>
          <label>
            Notes
            <textarea name="notes" defaultValue={game.notes ?? ""} />
          </label>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save notes"}
          </Button>
        </form>
      </Panel>
      <Button variant="quiet" disabled={deleting} onClick={removeGame}>
        {deleting ? "Removing…" : "Remove from library"}
      </Button>
    </main>
  );
}
