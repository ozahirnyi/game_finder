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
  return value?.price
    ? `${value.price.amount} ${value.price.currency}`
    : "Price unavailable";
}

function DealCover({ deal }: { deal: HomeDeal }) {
  if (!deal.background_image) {
    return (
      <div
        className="aspect-video w-full bg-secondary"
        aria-label={`${deal.name} cover unavailable`}
      />
    );
  }
  return (
    <img
      className="aspect-video w-full object-cover"
      src={deal.background_image}
      alt={`${deal.name} cover`}
    />
  );
}

export function PublicDeals({
  initialCountry,
  limit,
}: {
  initialCountry: string;
  limit: number;
}) {
  const [country, setCountry] = useState(initialCountry.toUpperCase());
  const [retry, setRetry] = useState(0);
  const [state, setState] = useState<DealsState>({
    status: "loading",
    country,
    fallback: false,
  });

  useEffect(() => {
    let active = true;

    const load = async () => {
      setState({ status: "loading", country, fallback: false });
      try {
        const response = await getHomepageDeals(country, limit);
        if (active)
          setState({
            status: "success",
            country,
            fallback: false,
            deals: response.results,
          });
      } catch {
        if (!shouldFallbackToUsd(country)) {
          if (active) setState({ status: "error", country });
          return;
        }
        try {
          const response = await getHomepageDeals(FALLBACK_REGION, limit);
          if (active)
            setState({
              status: "success",
              country: FALLBACK_REGION,
              fallback: true,
              deals: response.results,
            });
        } catch {
          if (active) setState({ status: "error", country: FALLBACK_REGION });
        }
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [country, limit, retry]);

  return (
    <section
      className="stagger-enter mx-auto max-w-6xl space-y-6"
      data-testid="public-deals"
      aria-labelledby="price-drops-heading"
    >
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-1 font-mono text-[11px] uppercase tracking-[0.25em] text-primary">
            Live deals
          </p>
          <h2 id="price-drops-heading" className="text-2xl font-bold">
            Price drops
          </h2>
        </div>
        <label className="text-sm font-medium text-muted-foreground">
          <span className="sr-only">Deal region</span>
          <select
            className="rounded-lg border border-border bg-surface px-3 py-2 text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
            value={country}
            onChange={(event) => setCountry(event.target.value)}
          >
            {supportedCountries.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
      </header>

      {state.status === "loading" ? (
        <div
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          aria-label="Loading price drops"
        >
          {Array.from(
            { length: Math.min(Math.max(limit, 3), 6) },
            (_, index) => (
              <div
                className="aspect-[4/5] rounded-2xl border border-border skeleton-shimmer"
                key={index}
              />
            ),
          )}
        </div>
      ) : null}

      {state.status === "error" ? (
        <div
          className="rounded-xl border border-border bg-surface p-5 text-sm text-muted-foreground"
          role="status"
        >
          <p>Price drops could not be loaded.</p>
          <button
            className="mt-3 rounded-lg border border-border bg-secondary px-3 py-2 font-bold text-foreground transition hover:border-primary/60"
            type="button"
            onClick={() => setRetry((value) => value + 1)}
          >
            Retry price drops
          </button>
        </div>
      ) : null}

      {state.status === "success" && state.deals.length === 0 ? (
        <p className="rounded-xl border border-border bg-surface p-5 text-sm text-muted-foreground">
          No price drops are available right now.
        </p>
      ) : null}

      {state.status === "success" && state.deals.length > 0 ? (
        <>
          {state.fallback ? (
            <p
              className="rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-primary"
              role="status"
            >
              Showing USD prices because local offers are unavailable.
            </p>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {state.deals.slice(0, limit).map((deal) => {
              const storeUrl = deal.current?.url ?? deal.url;
              return (
                <article
                  className="card-interactive overflow-hidden rounded-2xl border border-border bg-surface"
                  key={deal.id ?? deal.name}
                >
                  <DealCover deal={deal} />
                  <div className="space-y-2 p-4">
                    <h3 className="font-bold">{deal.name}</h3>
                    {deal.current?.shop ? (
                      <p className="text-sm text-muted-foreground">
                        {deal.current.shop}
                      </p>
                    ) : null}
                    {deal.current?.regular ? (
                      <p className="text-sm text-muted-foreground">
                        <s>
                          {deal.current.regular.amount}{" "}
                          {deal.current.regular.currency}
                        </s>
                      </p>
                    ) : null}
                    <p className="font-semibold text-primary">
                      Current price: {money(deal.current)}
                    </p>
                    {deal.current?.cut ? (
                      <p className="text-sm font-bold text-primary">
                        -{deal.current.cut}%
                      </p>
                    ) : null}
                    {storeUrl ? (
                      <a
                        className="inline-flex text-sm font-bold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        href={storeUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open store
                      </a>
                    ) : null}
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
