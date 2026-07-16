"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Panel, StatePanel } from "@/components/ui";
import { SavedGame, isAuthenticated, listSavedGames } from "@/lib/api";

function isWishlisted(game: SavedGame) {
  return /\bwishlist\b/i.test(game.notes ?? "");
}

export function WishlistScreen() {
  const authenticated = isAuthenticated();
  const [games, setGames] = useState<SavedGame[]>([]);
  const [loading, setLoading] = useState(authenticated);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!authenticated) return;
    let active = true;
    listSavedGames()
      .then((savedGames) => active && setGames(savedGames.filter(isWishlisted)))
      .catch(() => active && setError("Could not load your wishlist."))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [authenticated]);

  if (!authenticated) {
    return <StatePanel kind="unauthenticated" title="Wishlist" detail="Sign in to view your wishlist." />;
  }
  if (loading) {
    return <StatePanel kind="loading" title="Loading your wishlist" />;
  }
  if (error) {
    return <StatePanel kind="error" title="Could not load your wishlist" detail={error} />;
  }

  return (
    <main className="stack">
      <header className="section-header">
        <p className="eyebrow">Wishlist</p>
        <h1>Games you want to play</h1>
        <p>Until a dedicated wishlist API exists, this shows saved games marked with a “wishlist” keyword in their notes.</p>
      </header>
      {games.length === 0 ? (
        <StatePanel kind="empty" title="No wishlist games yet" detail="Add the word “wishlist” to a saved game’s notes to include it here." />
      ) : games.map((game) => (
        <Panel as="article" key={game.id}>
          <h2><Link href={`/favorites/${game.id}`}>{game.title}</Link></h2>
          {game.notes ? <p>{game.notes}</p> : null}
        </Panel>
      ))}
    </main>
  );
}
