"use client";

import { useEffect, useState } from "react";
import { GameCover } from "@/components/GameCover";
import { StatePanel } from "@/components/ui";
import { createSavedGame, getCatalogGame, getGamePriceHistory, isAuthenticated, type CatalogGame, type GamePriceHistory } from "@/lib/api";
type RemoteState<T> = { status: "loading" } | { status: "error"; message: string } | { status: "success"; data: T };

export function GameDetailScreen({ gameId }: { gameId: string }) {
  const [game, setGame] = useState<RemoteState<CatalogGame>>({ status: "loading" });
  const [price, setPrice] = useState<RemoteState<GamePriceHistory>>({ status: "loading" });
  const [gameRetry, setGameRetry] = useState(0);
  const [priceRetry, setPriceRetry] = useState(0);
  const [wishlistState, setWishlistState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  useEffect(() => { let active = true; void getCatalogGame(gameId).then((data) => active && setGame({ status: "success", data })).catch(() => active && setGame({ status: "error", message: "Game details could not be loaded." })); return () => { active = false; }; }, [gameId, gameRetry]);
  useEffect(() => { let active = true; void getGamePriceHistory(gameId).then((data) => active && setPrice({ status: "success", data })).catch(() => active && setPrice({ status: "error", message: "Price history could not be loaded." })); return () => { active = false; }; }, [gameId, priceRetry]);
  async function addToWishlist() {
    if (game.status !== "success" || !isAuthenticated()) return;
    setWishlistState("saving");
    try { await createSavedGame(game.data.name, undefined, "wishlist", `rawg:${game.data.id}`); setWishlistState("saved"); }
    catch { setWishlistState("error"); }
  }
  return <section className="stack"><section>{game.status === "loading" ? <StatePanel kind="loading" title="Loading game details" /> : null}{game.status === "error" ? <StatePanel kind="error" title="Could not load game details" detail={game.message} action={{ label: "Retry game details", onClick: () => { setGame({ status: "loading" }); setGameRetry((value) => value + 1); } }} /> : null}{game.status === "success" ? <><GameCover title={game.data.name} from="#231942" to="#5e548e" /><header><h1>{game.data.name}</h1><p>{game.data.released ?? "Release date unknown"}</p><p>{game.data.rating == null ? "Rating unavailable" : `Rating: ${game.data.rating} / 5`}</p></header><p>{game.data.description_raw ?? "No description available."}</p>{isAuthenticated() ? <button disabled={wishlistState === "saving" || wishlistState === "saved"} onClick={addToWishlist}>{wishlistState === "saved" ? "Added to wishlist" : "Add to wishlist"}</button> : null}{wishlistState === "error" ? <p role="alert">Could not add to wishlist.</p> : null}</> : null}</section><section><h2>Current price</h2>{price.status === "loading" ? <StatePanel kind="loading" title="Loading price history" /> : null}{price.status === "error" ? <StatePanel kind="error" title="Could not load price history" detail={price.message} action={{ label: "Retry price history", onClick: () => { setPrice({ status: "loading" }); setPriceRetry((value) => value + 1); } }} /> : null}{price.status === "success" ? <><p>{price.data.current?.price ? `${price.data.current.price.amount} ${price.data.current.price.currency}` : "No current price available"}</p><ul>{price.data.history.map((point) => <li key={`${point.timestamp}-${point.shop}`}>{`${point.shop ?? "Store"} · ${point.price?.amount ?? "—"} ${point.price?.currency ?? ""}`}</li>)}</ul></> : null}</section></section>;
}
