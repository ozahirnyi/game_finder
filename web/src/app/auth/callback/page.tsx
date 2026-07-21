"use client";

import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Suspense, useEffect, useState } from "react";
import { exchangeGoogleCode, exchangeSteamCode, setToken } from "@/lib/api";

export function OAuthCallback() {
  const navigate = useNavigate();
  const params = new URLSearchParams(
    useRouterState({ select: (state) => state.location.searchStr }),
  );
  const provider = params.get("provider");
  const [message, setMessage] = useState("Completing sign-in...");
  const code = params.get("exchange_code");
  const error = params.get("error");
  const invalid =
    (provider !== "google" && provider !== "steam") || !code || Boolean(error);

  useEffect(() => {
    if (invalid || !code) return;
    const exchange =
      provider === "steam" ? exchangeSteamCode : exchangeGoogleCode;
    exchange(code)
      .then((data) => {
        setToken(data.access_token);
        navigate({ to: "/profile", replace: true });
      })
      .catch(() => setMessage("Sign-in expired. Please try again."));
  }, [code, invalid, navigate, provider]);

  const providerName = provider === "steam" ? "Steam" : "Google";
  const displayMessage = error
    ? "Sign-in was cancelled or could not be completed. Please try again."
    : invalid
      ? "Sign-in was cancelled or expired."
      : message;
  return (
    <section className="auth-page">
      <div className="auth-panel auth-panel--elevated auth-callback">
        <p className="eyebrow">Secure handoff</p>
        <h1>{providerName} sign-in</h1>
        <p role="status">{displayMessage}</p>
        {!displayMessage.startsWith("Completing") && (
          <Link className="button secondary" to="/login">
            Back to sign in
          </Link>
        )}
      </div>
    </section>
  );
}

export default function OAuthCallbackPage() {
  return (
    <Suspense fallback={null}>
      <OAuthCallback />
    </Suspense>
  );
}
