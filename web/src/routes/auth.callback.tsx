import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { exchangeGoogleCode, exchangeSteamCode, setToken } from "@/lib/api";

export const Route = createFileRoute("/auth/callback")({
  validateSearch: (search: Record<string, unknown>) => ({
    provider: typeof search.provider === "string" ? search.provider : "",
    exchangeCode: typeof search.exchange_code === "string" ? search.exchange_code : "",
  }),
  component: OAuthCallback,
});

function OAuthCallback() {
  const navigate = useNavigate();
  const { provider, exchangeCode } = Route.useSearch();
  const [message, setMessage] = useState("Completing sign-in...");
  const invalid = (provider !== "google" && provider !== "steam") || !exchangeCode;

  useEffect(() => {
    if (invalid) return;
    const exchange = provider === "steam" ? exchangeSteamCode : exchangeGoogleCode;
    void exchange(exchangeCode)
      .then((data) => {
        setToken(data.access_token);
        navigate({ to: "/profile", replace: true });
      })
      .catch(() => setMessage("Sign-in expired. Please try again."));
  }, [exchangeCode, invalid, navigate, provider]);

  const providerName = provider === "steam" ? "Steam" : "Google";
  const displayMessage = invalid ? "Sign-in was cancelled or expired." : message;
  return <section className="auth-page"><div className="auth-panel auth-panel--elevated auth-callback"><p className="eyebrow">Secure handoff</p><h1>{providerName} sign-in</h1><p role="status">{displayMessage}</p>{!displayMessage.startsWith("Completing") ? <Link className="button secondary" to="/login">Back to sign in</Link> : null}</div></section>;
}
