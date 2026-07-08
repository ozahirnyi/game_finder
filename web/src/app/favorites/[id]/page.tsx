"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiError, SavedGame, deleteSavedGame, getSavedGame, isAuthenticated } from "@/lib/api";

export default function SavedGamePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [game, setGame] = useState<SavedGame | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push("/login?message=Log in to open your saved games.");
      return;
    }

    let active = true;
    getSavedGame(params.id)
      .then((data) => {
        if (active) {
          setGame(data);
        }
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof ApiError ? err.message : "Could not load this saved game.");
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
  }, [params.id, router]);

  async function removeGame() {
    if (!game) {
      return;
    }
    setDeleting(true);
    setError("");
    try {
      await deleteSavedGame(game.id);
      router.push("/favorites");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not remove this game.");
      setDeleting(false);
    }
  }

  if (loading) {
    return <p className="alert">Loading saved game...</p>;
  }

  if (error && !game) {
    return (
      <section className="stack">
        <p className="alert error">{error}</p>
        <Link className="button secondary fit" href="/favorites">
          Back to saved games
        </Link>
      </section>
    );
  }

  if (!game) {
    return <p className="alert error">Saved game not found.</p>;
  }

  return (
    <section className="saved-detail stack">
      <div className="section-header">
        <p className="eyebrow">Saved game</p>
        <h1>{game.title}</h1>
        <p>{game.notes || "No personal notes yet."}</p>
      </div>

      {error && <p className="alert error">{error}</p>}

      {game.info && (
        <div className="info-panel">
          <p className="eyebrow">Game info</p>
          <p>{game.info}</p>
        </div>
      )}

      <div className="meta-row">
        <span>Saved {new Date(game.created_at).toLocaleDateString()}</span>
      </div>

      <div className="actions">
        <Link className="button secondary" href="/favorites">
          Back to saved games
        </Link>
        <button className="danger" type="button" onClick={removeGame} disabled={deleting}>
          {deleting ? "Deleting..." : "Delete"}
        </button>
      </div>
    </section>
  );
}
