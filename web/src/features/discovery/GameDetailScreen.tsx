"use client";

import { useEffect, useState } from "react";
import { GameCover } from "@/components/GameCover";
import { StatePanel } from "@/components/ui";
import { getCatalogGame, getGamePriceHistory, type CatalogGame, type GamePriceHistory } from "@/lib/api";
type RemoteState<T> = { status: "loading" } | { status: "error"; message: string } | { status: "success"; data: T };
export function GameDetailScreen({ gameId }: { gameId: string }) {
  const [game, setGame] = useState<RemoteState<CatalogGame>>({ status: "loading" }); const [price, setPrice] = useState<RemoteState<GamePriceHistory>>({ status: "loading" }); const [retry, setRetry] = useState(0);
  useEffect(() => { let active = true; void getCatalogGame(gameId).then((data) => active && setGame({ status: "success", data })).catch(() => active && setGame({ status: "error", message: "Game details could not be loaded." })); void getGamePriceHistory(gameId).then((data) => active && setPrice({ status: "success", data })).catch(() => active && setPrice({ status: "error", message: "Price history could not be loaded." })); return () => { active = false; }; }, [gameId, retry]);
  if (game.status === "loading") return <StatePanel kind="loading" title="Loading game details" />;
  if (game.status === "error") return <StatePanel kind="error" title="Could not load game details" detail={game.message} action={{ label: "Retry", onClick: () => { setGame({ status: "loading" }); setPrice({ status: "loading" }); setRetry((value) => value + 1); } }} />;
  return <section className="stack"><GameCover title={game.data.name} src={game.data.background_image} /><header><h1>{game.data.name}</h1><p>{game.data.released ?? "Release date unknown"}</p></header><p>{game.data.description_raw ?? "No description available."}</p><section><h2>Current price</h2>{price.status === "loading" ? <StatePanel kind="loading" title="Loading price history" /> : null}{price.status === "error" ? <StatePanel kind="error" title="Could not load price history" detail={price.message} action={{ label: "Retry", onClick: () => { setPrice({ status: "loading" }); setRetry((value) => value + 1); } }} /> : null}{price.status === "success" ? <p>{price.data.current?.price ? `${price.data.current.price.amount} ${price.data.current.price.currency}` : "No current price available"}</p> : null}</section></section>;
}
