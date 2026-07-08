"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ApiError, CatalogGame, createSavedGame, getCatalogGame, isAuthenticated } from "@/lib/api";

export default function GameDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [game, setGame] = useState<CatalogGame | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadGame() {
      setLoading(true);
      setError("");
      try {
        const data = await getCatalogGame(params.id);
        if (active) {
          setGame(data);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof ApiError ? err.message : "Could not load this game.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadGame();

    return () => {
      active = false;
    };
  }, [params.id]);

  const gameInfo = useMemo(() => {
    if (!game) {
      return "";
    }
    const parts = [
      game.released ? `Released: ${game.released}` : null,
      game.rating ? `Rating: ${game.rating}` : null,
      game.platforms.length ? `Platforms: ${game.platforms.slice(0, 4).join(", ")}` : null,
    ].filter(Boolean);
    return parts.join(" | ").slice(0, 500);
  }, [game]);

  async function addToFavorites() {
    if (!game) {
      return;
    }
    if (!isAuthenticated()) {
      router.push("/login?message=Log in to save this game.");
      return;
    }

    setSaving(true);
    setMessage("");
    setError("");
    try {
      await createSavedGame(game.name, gameInfo);
      setMessage("Saved to your library.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save this game yet.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="alert">Loading game details...</p>;
  }

  if (error && !game) {
    return (
      <section className="stack">
        <p className="alert error">{error}</p>
        <Link className="button secondary fit" href="/">
          Back to search
        </Link>
      </section>
    );
  }

  if (!game) {
    return <p className="alert error">Game not found.</p>;
  }

  return (
    <section className="detail-layout">
      <div className="detail-image">
        {game.background_image ? (
          <Image src={game.background_image} alt="" fill sizes="(max-width: 900px) 100vw, 45vw" priority />
        ) : (
          <span>No image</span>
        )}
      </div>
      <div className="stack">
        <div className="section-header compact">
          <p className="eyebrow">Game profile</p>
          <h1>{game.name}</h1>
          <p>{game.released ? `Released ${game.released}` : "Release date unknown"}</p>
        </div>
        <div className="meta-row">
          {game.rating !== null && <span>Rating {game.rating}</span>}
          {game.genres.map((genre) => (
            <span key={genre}>{genre}</span>
          ))}
        </div>
        <p className="description">{game.description_raw || "No description available from RAWG."}</p>
        {game.platforms.length > 0 && (
          <p className="muted">
            Platforms: {game.platforms.slice(0, 8).join(", ")}
            {game.platforms.length > 8 ? "..." : ""}
          </p>
        )}
        {message && <p className="alert success">{message}</p>}
        {error && <p className="alert error">{error}</p>}
        <div className="actions">
          <button type="button" onClick={addToFavorites} disabled={saving}>
            {saving ? "Saving..." : "Save game"}
          </button>
          <Link className="button secondary" href="/">
            Back to search
          </Link>
        </div>
      </div>
    </section>
  );
}
