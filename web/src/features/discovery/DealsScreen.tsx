"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { GameCover } from "@/components/GameCover";
import { StatePanel } from "@/components/ui";
import { getHomepageDeals, type HomeDeal } from "@/lib/api";
type RemoteState<T> =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; data: T };
const money = (value: HomeDeal["current"] extends infer T ? T : never) =>
  value?.price
    ? `${value.price.amount} ${value.price.currency}`
    : "Price unavailable";
export function DealsScreen() {
  const [state, setState] = useState<RemoteState<HomeDeal[]>>({
    status: "loading",
  });
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    void getHomepageDeals("US", 12)
      .then(
        (data) => active && setState({ status: "success", data: data.results }),
      )
      .catch(
        () =>
          active &&
          setState({ status: "error", message: "Deals could not be loaded." }),
      );
    return () => {
      active = false;
    };
  }, [retry]);
  if (state.status === "loading")
    return <StatePanel kind="loading" title="Loading deals" />;
  if (state.status === "error")
    return (
      <StatePanel
        kind="error"
        title="Could not load deals"
        detail={state.message}
        action={{
          label: "Retry",
          onClick: () => {
            setState({ status: "loading" });
            setRetry((value) => value + 1);
          },
        }}
      />
    );
  if (!state.data.length)
    return <StatePanel kind="empty" title="No deals available" />;
  return (
    <section className="stack">
      <header className="section-header">
        <p className="eyebrow">Deals</p>
        <h1>Worth a look</h1>
      </header>
      <div className="game-grid">
        {state.data.map((deal) => (
          <article className="game-card" key={deal.id ?? deal.name}>
            <GameCover title={deal.name} src={deal.background_image} />
            <h2>{deal.name}</h2>
            <p>{money(deal.current)}</p>
            {deal.id ? (
              <Link href={`/games/${deal.id}`}>View details</Link>
            ) : null}
            {deal.url ? (
              <a href={deal.url} target="_blank" rel="noreferrer">
                Open store
              </a>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
