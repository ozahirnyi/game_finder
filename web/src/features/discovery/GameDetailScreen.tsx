"use client";

import { useEffect, useState } from "react";
import { GameCover } from "@/components/GameCover";
import { StatePanel } from "@/components/ui";
import {
  getCatalogGame,
  getGamePriceHistory,
  getTelegramAccount,
  createFavorite,
  deleteFavorite,
  isAuthenticated,
  listFavorites,
  listPriceAlerts,
  type CatalogGame,
  type GamePriceHistory,
  type PriceAlert,
  type TelegramAccount,
} from "@/lib/api";
import { AlertControls } from "@/features/retention/AlertControls";
type RemoteState<T> =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; data: T };

export function GameDetailScreen({ gameId }: { gameId: string }) {
  const [game, setGame] = useState<RemoteState<CatalogGame>>({
    status: "loading",
  });
  const [price, setPrice] = useState<RemoteState<GamePriceHistory>>({
    status: "loading",
  });
  const [gameRetry, setGameRetry] = useState(0);
  const [priceRetry, setPriceRetry] = useState(0);
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [telegram, setTelegram] = useState<TelegramAccount>({
    linked: false,
    configured: false,
    username: null,
    linked_at: null,
  });
  const [alertsRetry, setAlertsRetry] = useState(0);
  const [favoriteId, setFavoriteId] = useState<string | null>(null);
  const [favoriteBusy, setFavoriteBusy] = useState(false);
  const [favoriteError, setFavoriteError] = useState("");
  useEffect(() => {
    let active = true;
    void getCatalogGame(gameId)
      .then((data) => active && setGame({ status: "success", data }))
      .catch(
        () =>
          active &&
          setGame({
            status: "error",
            message: "Game details could not be loaded.",
          }),
      );
    return () => {
      active = false;
    };
  }, [gameId, gameRetry]);
  useEffect(() => {
    let active = true;
    void getGamePriceHistory(gameId)
      .then((data) => active && setPrice({ status: "success", data }))
      .catch(
        () =>
          active &&
          setPrice({
            status: "error",
            message: "Price history could not be loaded.",
          }),
      );
    return () => {
      active = false;
    };
  }, [gameId, priceRetry]);
  useEffect(() => {
    void Promise.all([listPriceAlerts(), getTelegramAccount()])
      .then(([alertData, telegramData]) => {
        setAlerts(alertData);
        setTelegram(telegramData);
      })
      .catch(() => undefined);
  }, [alertsRetry]);
  useEffect(() => {
    if (!isAuthenticated()) return;
    void listFavorites().then((items) => setFavoriteId(items.find((item) => item.identity_kind === "rawg" && item.identity_value === gameId)?.id ?? null)).catch(() => setFavoriteError("Could not load favorites."));
  }, [gameId]);
  async function toggleFavorite() {
    if (game.status !== "success") return;
    setFavoriteBusy(true); setFavoriteError("");
    try {
      if (favoriteId) { await deleteFavorite(favoriteId); setFavoriteId(null); }
      else { const item = await createFavorite({ identity_kind: "rawg", identity_value: String(game.data.id), title: game.data.name, cover_url: game.data.background_image }); setFavoriteId(item.id); }
    } catch { setFavoriteError("Could not update favorites."); } finally { setFavoriteBusy(false); }
  }
  return (
    <section className="stack">
      <section>
        {game.status === "loading" ? (
          <StatePanel kind="loading" title="Loading game details" />
        ) : null}
        {game.status === "error" ? (
          <StatePanel
            kind="error"
            title="Could not load game details"
            detail={game.message}
            action={{
              label: "Retry game details",
              onClick: () => {
                setGame({ status: "loading" });
                setGameRetry((value) => value + 1);
              },
            }}
          />
        ) : null}
        {game.status === "success" ? (
          <>
            <GameCover
              title={game.data.name}
              src={game.data.background_image}
            />
            <header>
              <h1>{game.data.name}</h1>
              <p>{game.data.released ?? "Release date unknown"}</p>
            </header>
            {isAuthenticated() ? <button type="button" disabled={favoriteBusy} onClick={toggleFavorite}>{favoriteId ? "Remove from favorites" : "Add to favorites"}</button> : null}
            {favoriteError ? <p role="alert">{favoriteError}</p> : null}
            <p>{game.data.description_raw ?? "No description available."}</p>
          </>
        ) : null}
      </section>
      <section>
        <h2>Current price</h2>
        {price.status === "loading" ? (
          <StatePanel kind="loading" title="Loading price history" />
        ) : null}
        {price.status === "error" ? (
          <StatePanel
            kind="error"
            title="Could not load price history"
            detail={price.message}
            action={{
              label: "Retry price history",
              onClick: () => {
                setPrice({ status: "loading" });
                setPriceRetry((value) => value + 1);
              },
            }}
          />
        ) : null}
        {price.status === "success" ? (
          <p>
            {price.data.current?.price
              ? `${price.data.current.price.amount} ${price.data.current.price.currency}`
              : "No current price available"}
          </p>
        ) : null}
      </section>
      {game.status === "success" && price.status === "success" ? (
        <AlertControls
          identity={{ kind: "rawg", value: String(game.data.id) }}
          title={game.data.name}
          alerts={alerts}
          telegram={telegram}
          supported={Boolean(price.data.itad_id)}
          onChanged={() => setAlertsRetry((value) => value + 1)}
        />
      ) : null}
    </section>
  );
}
