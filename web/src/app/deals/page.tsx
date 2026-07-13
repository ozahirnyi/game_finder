"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ApiError,
  GamePriceHistory,
  HomeDeal,
  SavedGame,
  getGamePriceHistory,
  getHomepageDeals,
  isAuthenticated,
  listSavedGames,
  searchGames,
} from "@/lib/api";

type FavoriteDeal = {
  saved: SavedGame;
  rawgId: number;
  image: string | null;
  prices: GamePriceHistory;
};

function formatMoney(value: { amount: number; currency: string } | null | undefined) {
  if (!value) {
    return "No price";
  }
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: value.currency,
      maximumFractionDigits: 2,
    }).format(value.amount);
  } catch {
    return `${value.amount} ${value.currency}`;
  }
}

function rawgIdFromInfo(info: string | null) {
  const match = info?.match(/RAWG ID:\s*(\d+)/i);
  return match ? Number(match[1]) : null;
}

function DealImage({ src, name, badge }: { src: string | null; name: string; badge?: number | null }) {
  return (
    <div className="deal-page-image">
      {src ? <Image src={src} alt="" fill sizes="(max-width: 760px) 100vw, 320px" /> : <span>{name.slice(0, 2)}</span>}
      {badge ? <span className="deal-badge">-{badge}%</span> : null}
    </div>
  );
}

export default function DealsPage() {
  const router = useRouter();
  const [deals, setDeals] = useState<HomeDeal[]>([]);
  const [favoriteDeals, setFavoriteDeals] = useState<FavoriteDeal[]>([]);
  const [topLoading, setTopLoading] = useState(true);
  const [favoritesLoading, setFavoritesLoading] = useState(false);
  const [error, setError] = useState("");
  const [favoritesError, setFavoritesError] = useState("");

  useEffect(() => {
    let active = true;

    getHomepageDeals("US", 12)
      .then((data) => {
        if (active) {
          setDeals(data.results);
        }
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof ApiError ? err.message : "Could not load current deals.");
        }
      })
      .finally(() => {
        if (active) {
          setTopLoading(false);
        }
      });

    if (isAuthenticated()) {
      async function loadFavoriteDeals() {
        setFavoritesLoading(true);
        try {
          const savedGames = await listSavedGames();
          const entries = await Promise.all(
            savedGames.slice(0, 12).map(async (saved) => {
              try {
                let rawgId = rawgIdFromInfo(saved.info);
                let image: string | null = null;
                const search = await searchGames(saved.title);
                const match = search.results.find((game) => (rawgId ? game.id === rawgId : game.id)) ?? null;
                image = match?.background_image ?? null;
                if (!rawgId) {
                  rawgId = match?.id ?? null;
                }
                if (!rawgId) {
                  return null;
                }
                const prices = await getGamePriceHistory(String(rawgId), "US");
                if (!prices.current?.price) {
                  return null;
                }
                return { saved, rawgId, image, prices };
              } catch {
                return null;
              }
            })
          );
          if (active) {
            setFavoriteDeals(entries.filter(Boolean) as FavoriteDeal[]);
          }
        } catch (err) {
          if (active) {
            if (err instanceof ApiError && err.status === 401) {
              router.push("/login?message=Your session expired. Please log in again.");
              return;
            }
            setFavoritesError(err instanceof ApiError ? err.message : "Could not load favorite deals.");
          }
        } finally {
          if (active) {
            setFavoritesLoading(false);
          }
        }
      }

      loadFavoriteDeals();
    }

    return () => {
      active = false;
    };
  }, [router]);

  return (
    <section className="stack">
      <div className="page-heading-row">
        <div className="section-header compact">
          <p className="eyebrow">Deals</p>
          <h1>Game discounts</h1>
          <p>Current Steam discounts and price checks for games you saved.</p>
        </div>
        <Link className="button secondary" href="/">
          Back to search
        </Link>
      </div>

      <div className="deals-layout">
        <section className="results-panel deals-hero-panel">
          <div className="results-heading">
            <div>
              <p className="eyebrow">Top deals</p>
              <h2>Popular games on sale now</h2>
            </div>
            <p>{topLoading ? "Loading" : `${deals.length} deals`}</p>
          </div>

          {error && <p className="alert error">{error}</p>}
          {!error && topLoading && <p className="alert">Loading discounts...</p>}
          {!error && !topLoading && deals.length === 0 && <p className="alert">No deals loaded yet.</p>}

          {deals.length > 0 && (
            <div className="deal-page-grid">
              {deals.map((deal) => (
                <article className="deal-page-card" key={`${deal.id}-${deal.name}`}>
                  <DealImage src={deal.background_image} name={deal.name} badge={deal.current?.cut} />
                  <div className="deal-page-body">
                    <h2>{deal.name}</h2>
                    <p>
                      <strong>{formatMoney(deal.current?.price)}</strong>
                      {deal.current?.shop ? ` at ${deal.current.shop}` : ""}
                    </p>
                    <p>Historical low: {formatMoney(deal.history_low_all)}</p>
                    <div className="recommendation-actions">
                      {deal.id ? (
                        <Link className="button secondary" href={`/games/${deal.id}`}>
                          Details
                        </Link>
                      ) : null}
                      {deal.url ? (
                        <a className="button secondary" href={deal.url} target="_blank" rel="noreferrer">
                          Store
                        </a>
                      ) : null}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="results-panel favorite-deals-panel">
          <div className="results-heading">
            <div>
              <p className="eyebrow">From favorites</p>
              <h2>Your saved games with prices</h2>
            </div>
            <p>{isAuthenticated() ? (favoritesLoading ? "Checking" : `${favoriteDeals.length} matches`) : "Login required"}</p>
          </div>

          {!isAuthenticated() && (
            <div className="empty-state compact-empty">
              <p>Log in to compare discounts against your saved games.</p>
              <Link className="button fit" href="/login?message=Log in to see favorite deals.">
                Login
              </Link>
            </div>
          )}
          {favoritesError && <p className="alert error">{favoritesError}</p>}
          {isAuthenticated() && favoritesLoading && <p className="alert">Checking your saved games...</p>}
          {isAuthenticated() && !favoritesLoading && favoriteDeals.length === 0 && (
            <p className="alert">No active prices found for your saved games yet.</p>
          )}

          {favoriteDeals.length > 0 && (
            <div className="deal-list">
              {favoriteDeals.map((item) => (
                <article className="deal-row" key={item.saved.id}>
                  <div className="compact-game-image">
                    {item.image ? <Image src={item.image} alt="" fill sizes="96px" /> : <span>{item.saved.title.slice(0, 2)}</span>}
                    {item.prices.current?.cut ? <span className="deal-badge mini">-{item.prices.current.cut}%</span> : null}
                  </div>
                  <div>
                    <h3>{item.saved.title}</h3>
                    <p>
                      <strong>{formatMoney(item.prices.current?.price)}</strong>
                      {item.prices.current?.shop ? ` at ${item.prices.current.shop}` : ""}
                    </p>
                    <p>Historical low: {formatMoney(item.prices.history_low_all)}</p>
                  </div>
                  <div className="compact-actions">
                    <Link className="button secondary" href={`/games/${item.rawgId}`}>
                      Details
                    </Link>
                    {item.prices.current?.url || item.prices.url ? (
                      <a
                        className="button secondary"
                        href={item.prices.current?.url ?? item.prices.url ?? "#"}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Store
                      </a>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
