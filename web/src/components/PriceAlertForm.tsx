import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { getTelegramAccount, type PriceAlertCreate } from "@/lib/api";

type AlertMode = "any_discount" | "target_price" | "target_discount";

export function PriceAlertForm({
  wishlistCatalogGameId,
  onSubmit,
  onCancel,
  isPending = false,
  errorMessage,
}: {
  wishlistCatalogGameId: number;
  onSubmit: (data: PriceAlertCreate) => void;
  onCancel?: () => void;
  isPending?: boolean;
  errorMessage?: string;
}) {
  const [mode, setMode] = useState<AlertMode>("any_discount");
  const [targetPrice, setTargetPrice] = useState("");
  const [targetDiscount, setTargetDiscount] = useState("");
  const [useTelegram, setUseTelegram] = useState(false);
  const telegramQuery = useQuery({ queryKey: ["telegram-account"], queryFn: getTelegramAccount });
  const telegramAvailable =
    telegramQuery.data?.configured === true && telegramQuery.data.linked === true;

  function selectMode(nextMode: AlertMode) {
    setMode(nextMode);
    setTargetPrice("");
    setTargetDiscount("");
  }

  function submit() {
    const delivery_channels: PriceAlertCreate["delivery_channels"] = ["in_app"];
    if (telegramAvailable && useTelegram) delivery_channels.push("telegram");
    if (mode === "any_discount") {
      onSubmit({
        wishlist_catalog_game_id: wishlistCatalogGameId,
        target_discount: 1,
        delivery_channels,
      });
      return;
    }
    const value = Number(mode === "target_price" ? targetPrice : targetDiscount);
    if (!Number.isFinite(value) || value <= 0) return;
    onSubmit(
      mode === "target_price"
        ? {
            wishlist_catalog_game_id: wishlistCatalogGameId,
            target_price: value,
            delivery_channels,
          }
        : {
            wishlist_catalog_game_id: wishlistCatalogGameId,
            target_discount: value,
            delivery_channels,
          },
    );
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <fieldset className="grid gap-2 text-sm">
        <legend className="font-bold">Alert when</legend>
        <label>
          <input
            type="radio"
            checked={mode === "any_discount"}
            onChange={() => selectMode("any_discount")}
          />{" "}
          Any discount
        </label>
        <label>
          <input
            type="radio"
            checked={mode === "target_price"}
            onChange={() => selectMode("target_price")}
          />{" "}
          Target price
        </label>
        <label>
          <input
            type="radio"
            checked={mode === "target_discount"}
            onChange={() => selectMode("target_discount")}
          />{" "}
          Target discount
        </label>
      </fieldset>
      {mode === "target_price" && (
        <label className="grid gap-1 text-sm font-semibold">
          Price
          <input
            aria-label="Price"
            type="number"
            min="0.01"
            step="0.01"
            required
            value={targetPrice}
            onChange={(event) => setTargetPrice(event.target.value)}
            className="rounded-md border border-border bg-background px-3 py-2"
          />
        </label>
      )}
      {mode === "target_discount" && (
        <label className="grid gap-1 text-sm font-semibold">
          Discount
          <input
            aria-label="Discount"
            type="number"
            min="1"
            max="100"
            required
            value={targetDiscount}
            onChange={(event) => setTargetDiscount(event.target.value)}
            className="rounded-md border border-border bg-background px-3 py-2"
          />
        </label>
      )}
      <div className="grid gap-1 text-sm">
        <label>
          <input type="checkbox" checked readOnly /> In-app
        </label>
        <label>
          <input
            type="checkbox"
            aria-label="Telegram"
            checked={useTelegram}
            disabled={!telegramAvailable}
            onChange={(event) => setUseTelegram(event.target.checked)}
          />{" "}
          Telegram
        </label>
        {!telegramAvailable && !telegramQuery.isLoading && (
          <p className="text-xs text-muted-foreground">
            {telegramQuery.data?.configured
              ? "Connect Telegram to enable Telegram delivery."
              : "Telegram delivery is not configured."}{" "}
            {telegramQuery.data?.configured && (
              <a className="text-primary hover:underline" href="/account">
                Connect Telegram
              </a>
            )}
          </p>
        )}
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-primary px-3 py-2 text-xs font-bold text-primary-foreground"
        >
          Save alert
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-border px-3 py-2 text-xs font-bold"
          >
            Cancel
          </button>
        )}
      </div>
      {errorMessage && (
        <p role="alert" className="text-xs text-destructive">
          {errorMessage}
        </p>
      )}
    </form>
  );
}
