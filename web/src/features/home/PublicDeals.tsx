"use client";

import { useEffect, useState } from "react";
import { getHomepageDeals, type HomeDeal } from "@/lib/api";
import { FALLBACK_REGION, shouldFallbackToUsd } from "./region";

type DealsState =
  | { status: "loading"; country: string; fallback: boolean }
  | { status: "success"; country: string; fallback: boolean; deals: HomeDeal[] }
  | { status: "error"; country: string };

const supportedCountries = ["UA", "US", "GB", "DE", "PL"];

function money(value: HomeDeal["current"] extends infer T ? T : never) {
  return value?.price ? `${value.price.amount} ${value.price.currency}` : "Price unavailable";
}

function DealCover({ deal }: { deal: HomeDeal }) {
  if (!deal.background_image) {
    return <div className="game-cover-fallback" aria-label={`${deal.name} cover unavailable`} />;
  }
  return <img className="game-cover" src={deal.background_image} alt={`${deal.name} cover`} />;
}

export function PublicDeals({ initialCountry, limit }: { initialCountry: string; limit: number }) {
  const [country, setCountry] = useState(initialCountry.toUpperCase());
  const [retry, setRetry] = useState(0);
  const [state, setState] = useState<DealsState>({ status: "loading", country, fallback: false });

  useEffect(() => {
    let active = true;

    const load = async () => {
      setState({ status: "loading", country, fallback: false });
      try {
        const response = await getHomepageDeals(country, limit);
        if (active) setState({ status: "success", country, fallback: false, deals: response.results });
      } catch {
        if (!shouldFallbackToUsd(country)) {
          if (active) setState({ status: "error", country });
          return;
        }
        try {
          const response = await getHomepageDeals(FALLBACK_REGION, limit);
          if (active) setState({ status: "success", country: FALLBACK_REGION, fallback: true, deals: response.results });
        } catch {
          if (active) setState({ status: "error", country: FALLBACK_REGION });
        }
      }
    };

    void load();
    return () => { active = false; };
  }, [country, limit, retry]);

  return (
    <section className="stack stagger-enter" data-testid="public-deals" aria-labelledby="price-drops-heading">
      <header className="section-header">
        <div>
          <p className="eyebrow">Live deals</p>
          <h2 id="price-drops-heading">Price drops</h2>
        </div>
        <label>
          <span className="sr-only">Deal region</span>
          <select value={country} onChange={(event) => setCountry(event.target.value)}>
            {supportedCountries.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
      </header>

      {state.status === "loading" ? (
        <div className="game-grid" aria-label="Loading price drops">
          {Array.from({ length: Math.min(Math.max(limit, 3), 6) }, (_, index) => <div className="game-card skeleton-shimmer" key={index} />)}
        </div>
      ) : null}

      {state.status === "error" ? (
        <div className="state-panel" role="status">
          <p>Price drops could not be loaded.</p>
          <button type="button" onClick={() => setRetry((value) => value + 1)}>Retry price drops</button>
        </div>
      ) : null}

      {state.status === "success" && state.deals.length === 0 ? <p>No price drops are available right now.</p> : null}

      {state.status === "success" && state.deals.length > 0 ? (
        <>
          {state.fallback ? <p role="status">Showing USD prices because local offers are unavailable.</p> : null}
          <div className="game-grid">
            {state.deals.slice(0, limit).map((deal) => {
              const storeUrl = deal.current?.url ?? deal.url;
              return (
                <article className="game-card card-interactive" key={deal.id ?? deal.name}>
                  <DealCover deal={deal} />
                  <div className="stack compact">
                    <h3>{deal.name}</h3>
                    {deal.current?.shop ? <p>{deal.current.shop}</p> : null}
                    {deal.current?.regular ? <p><s>{deal.current.regular.amount} {deal.current.regular.currency}</s></p> : null}
                    <p>Current price: {money(deal.current)}</p>
                    {deal.current?.cut ? <p>-{deal.current.cut}%</p> : null}
                    {storeUrl ? <a href={storeUrl} target="_blank" rel="noreferrer">Open store</a> : null}
                  </div>
                </article>
              );
            })}
          </div>
        </>
      ) : null}
    </section>
  );
}
