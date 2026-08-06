import { useMemo, useState } from "react";
import { createPriceAlert, deletePriceAlert, type PriceAlert } from "@/lib/api";

type AlertControlsProps = {
  identity: { kind: "rawg" | "steam"; value: string };
  title: string;
  alerts: PriceAlert[];
  telegram: { linked: boolean; configured: boolean };
  supported?: boolean;
  onChanged?: () => void;
};

function errorMessage(error: unknown) {
  if (typeof error === "object" && error && "detail" in error) {
    return String(error.detail);
  }
  return error instanceof Error
    ? error.message
    : "Could not create this price alert.";
}

export function AlertControls({
  identity,
  title,
  alerts,
  telegram,
  supported = true,
  onChanged,
}: AlertControlsProps) {
  const [mode, setMode] = useState<PriceAlert["mode"]>("any_discount");
  const [threshold, setThreshold] = useState("");
  const [inApp, setInApp] = useState(true);
  const [useTelegram, setUseTelegram] = useState(false);
  const [error, setError] = useState("");
  const availableTelegram = telegram.linked && telegram.configured;
  const matchingAlerts = useMemo(
    () =>
      alerts.filter(
        (alert) =>
          alert.identity_kind === identity.kind &&
          alert.identity_value === identity.value,
      ),
    [alerts, identity.kind, identity.value],
  );

  if (!supported) {
    return (
      <p role="status">Price alerts are not available for this Steam game.</p>
    );
  }

  const submit = async () => {
    const parsedThreshold = Number(threshold);
    if (
      mode !== "any_discount" &&
      (!Number.isFinite(parsedThreshold) || parsedThreshold <= 0)
    ) {
      setError("Enter a positive threshold.");
      return;
    }
    setError("");
    try {
      await createPriceAlert({
        identity_kind: identity.kind,
        identity_value: identity.value,
        title,
        mode,
        threshold: mode === "any_discount" ? null : parsedThreshold,
        in_app: inApp,
        telegram: availableTelegram && useTelegram,
      });
      setThreshold("");
      onChanged?.();
    } catch (reason) {
      setError(errorMessage(reason));
    }
  };

  return (
    <section aria-label="Price alerts" className="stack">
      <h3>Price alerts</h3>
      {matchingAlerts.map((alert) => (
        <div key={alert.id}>
          <span>
            {alert.mode === "any_discount"
              ? "Any discount"
              : `${alert.mode === "target_price" ? "Target price" : "Target discount"}: ${alert.threshold}`}
          </span>
          <button
            type="button"
            aria-label="Delete alert"
            onClick={() => void deletePriceAlert(alert.id).then(onChanged)}
          >
            Delete
          </button>
        </div>
      ))}
      <fieldset>
        <legend>Condition</legend>
        {(["any_discount", "target_price", "target_discount"] as const).map(
          (value) => (
            <label key={value}>
              <input
                type="radio"
                name={`alert-mode-${identity.kind}-${identity.value}`}
                checked={mode === value}
                onChange={() => setMode(value)}
              />
              {value === "any_discount"
                ? "Any discount"
                : value === "target_price"
                  ? "Target price"
                  : "Target discount"}
            </label>
          ),
        )}
      </fieldset>
      {mode !== "any_discount" ? (
        <label>
          {mode === "target_price" ? "Target price" : "Discount percentage"}
          <input
            aria-label={
              mode === "target_price" ? "Target price" : "Discount percentage"
            }
            type="number"
            min="0"
            value={threshold}
            onChange={(event) => setThreshold(event.target.value)}
          />
        </label>
      ) : null}
      <label>
        <input
          type="checkbox"
          checked={inApp}
          onChange={(event) => setInApp(event.target.checked)}
        />{" "}
        In-app
      </label>
      <label>
        <input
          type="checkbox"
          aria-label="Telegram"
          checked={useTelegram}
          disabled={!availableTelegram}
          onChange={(event) => setUseTelegram(event.target.checked)}
        />{" "}
        Telegram
      </label>
      {!availableTelegram ? (
        <a href="/profile">Connect Telegram in Profile</a>
      ) : null}
      {error ? <p role="alert">{error}</p> : null}
      <button type="button" onClick={() => void submit()}>
        Create alert
      </button>
    </section>
  );
}
