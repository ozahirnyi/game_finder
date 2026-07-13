"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ApiError,
  CatalogGame,
  GamePriceHistory,
  PriceMoney,
  createSavedGame,
  getCatalogGame,
  getGamePriceHistory,
  getSteamAccount,
  isAuthenticated,
} from "@/lib/api";

function formatMoney(value?: PriceMoney | null) {
  if (!value) {
    return "Unavailable";
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: value.currency,
  }).format(value.amount);
}

export default function GameDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [game, setGame] = useState<CatalogGame | null>(null);
  const [prices, setPrices] = useState<GamePriceHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [pricesLoading, setPricesLoading] = useState(true);
  const [priceCountry, setPriceCountry] = useState("US");
  const [saving, setSaving] = useState(false);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [priceError, setPriceError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadGame() {
      setLoading(true);
      setError("");
      setDescriptionExpanded(false);
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

  useEffect(() => {
    let active = true;

    async function loadPrices() {
      setPricesLoading(true);
      setPriceError("");
      setPrices(null);
      setPriceCountry("US");
      try {
        let country = "US";
        if (isAuthenticated()) {
          try {
            const steam = await getSteamAccount();
            const steamCountry = steam.linked ? steam.country_code?.trim().toUpperCase() : null;
            if (steamCountry && /^[A-Z]{2}$/.test(steamCountry)) {
              country = steamCountry;
            }
          } catch {
            country = "US";
          }
        }
        const data = await getGamePriceHistory(params.id, country);
        if (active) {
          setPriceCountry(country);
          setPrices(data);
        }
      } catch (err) {
        if (active) {
          setPriceError(err instanceof ApiError ? err.message : "Could not load price history.");
        }
      } finally {
        if (active) {
          setPricesLoading(false);
        }
      }
    }

    loadPrices();

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
      if (err instanceof ApiError && err.status === 401) {
        router.push("/login?message=Your session expired. Please log in again.");
        return;
      }
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
        <section className="description-panel">
          <div className="results-heading">
            <div>
              <p className="eyebrow">Overview</p>
              <h2>About this game</h2>
            </div>
            {game.description_raw && game.description_raw.length > 360 && (
              <button
                className="secondary fit"
                type="button"
                onClick={() => setDescriptionExpanded((current) => !current)}
              >
                {descriptionExpanded ? "Show less" : "Show more"}
              </button>
            )}
          </div>
          <p className={`description ${descriptionExpanded ? "expanded" : ""}`}>
            {game.description_raw || "No description available from RAWG."}
          </p>
        </section>
        {game.platforms.length > 0 && (
          <p className="muted">
            Platforms: {game.platforms.slice(0, 8).join(", ")}
            {game.platforms.length > 8 ? "..." : ""}
          </p>
        )}
        <section className="info-panel price-panel">
          <div className="results-heading">
            <div>
              <p className="eyebrow">Price history</p>
              <h2>Current deal and lows</h2>
              <p>Region: {priceCountry}</p>
            </div>
            {prices?.url && (
              <a className="button secondary" href={prices.url} target="_blank" rel="noreferrer">
                Open ITAD
              </a>
            )}
          </div>

          {pricesLoading && <p className="alert">Loading price history...</p>}
          {priceError && !pricesLoading && <p className="alert error">{priceError}</p>}
          {prices && !pricesLoading && (
            <>
              <div className="price-summary-grid">
                <div>
                  <span>Current best</span>
                  <strong>{formatMoney(prices.current?.price)}</strong>
                  <p>
                    {prices.current?.shop ? `${prices.current.shop}` : "No active store price"}
                    {prices.current?.cut ? ` | -${prices.current.cut}%` : ""}
                  </p>
                </div>
                <div>
                  <span>Historical low</span>
                  <strong>{formatMoney(prices.history_low_all)}</strong>
                  <p>All-time low across tracked stores</p>
                </div>
                <div>
                  <span>1 year low</span>
                  <strong>{formatMoney(prices.history_low_1y)}</strong>
                  <p>Lowest tracked price in the last year</p>
                </div>
                <div>
                  <span>3 month low</span>
                  <strong>{formatMoney(prices.history_low_3m)}</strong>
                  <p>Lowest tracked price in the last 3 months</p>
                </div>
              </div>

              {prices.deals.length > 0 && (
                <div className="price-deal-list">
                  {prices.deals.slice(0, 5).map((deal) => (
                    <a
                      className="price-deal-row"
                      href={deal.url ?? prices.url ?? "#"}
                      target="_blank"
                      rel="noreferrer"
                      key={`${deal.shop}-${deal.price?.amount}-${deal.url}`}
                    >
                      <span>{deal.shop ?? "Store"}</span>
                      <strong>{formatMoney(deal.price)}</strong>
                      <small>
                        {deal.regular ? `Regular ${formatMoney(deal.regular)}` : "Regular price unavailable"}
                        {deal.cut ? ` | -${deal.cut}%` : ""}
                      </small>
                    </a>
                  ))}
                </div>
              )}
            </>
          )}
        </section>
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
