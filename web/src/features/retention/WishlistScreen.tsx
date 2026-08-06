import { useEffect, useState } from "react";
import { AlertControls } from "./AlertControls";
import {
  deleteWishlistItem,
  getTelegramAccount,
  listPriceAlerts,
  listWishlist,
  type PriceAlert,
  type TelegramAccount,
  type WishlistItem,
} from "@/lib/api";

type State = "loading" | "error" | "success";

export function WishlistScreen() {
  const [state, setState] = useState<State>("loading");
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [telegram, setTelegram] = useState<TelegramAccount>({
    linked: false,
    configured: false,
    username: null,
    linked_at: null,
  });
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    void Promise.all([listWishlist(), listPriceAlerts(), getTelegramAccount()])
      .then(([wishlist, alertData, telegramData]) => {
        if (!active) return;
        setItems(wishlist);
        setAlerts(alertData);
        setTelegram(telegramData);
        setState("success");
      })
      .catch(() => active && setState("error"));
    return () => {
      active = false;
    };
  }, [reload]);
  if (state === "loading") return <p>Loading wishlist…</p>;
  if (state === "error")
    return (
      <section>
        <p>Wishlist could not be loaded.</p>
        <button
          type="button"
          onClick={() => {
            setState("loading");
            setReload((value) => value + 1);
          }}
        >
          Retry
        </button>
      </section>
    );
  if (!items.length)
    return (
      <section>
        <p>Your wishlist is empty.</p>
        <a href="/search">Search games</a>
      </section>
    );
  return (
    <section className="stack">
      <h1>Wishlist</h1>
      {items.map((item) => (
        <article key={item.id}>
          <h2>{item.title}</h2>
          <button
            type="button"
            aria-label={`Remove ${item.title}`}
            onClick={() =>
              void deleteWishlistItem(item.id).then(() =>
                setReload((value) => value + 1),
              )
            }
          >
            Remove
          </button>
          <AlertControls
            identity={{ kind: item.identity_kind, value: item.identity_value }}
            title={item.title}
            alerts={alerts}
            telegram={telegram}
            onChanged={() => setReload((value) => value + 1)}
          />
        </article>
      ))}
    </section>
  );
}
