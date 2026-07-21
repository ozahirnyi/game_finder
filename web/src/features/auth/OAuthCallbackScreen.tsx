import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { exchangeGoogleCode, exchangeSteamCode, setToken } from "@/lib/api";
import { oauthErrorMessage, type OAuthProvider } from "./oauth";

type OAuthCallbackScreenProps = {
  provider?: string;
  exchangeCode?: string;
  error?: string;
};

export function OAuthCallbackScreen({
  provider,
  exchangeCode,
  error,
}: OAuthCallbackScreenProps) {
  const navigate = useNavigate();
  const [message, setMessage] = useState("Completing sign-in...");
  const validProvider = provider === "google" || provider === "steam";
  const canExchange = validProvider && Boolean(exchangeCode) && !error;

  useEffect(() => {
    if (!canExchange || !exchangeCode) return;
    const exchange =
      provider === "steam" ? exchangeSteamCode : exchangeGoogleCode;
    exchange(exchangeCode)
      .then(async ({ access_token }) => {
        setToken(access_token);
        await navigate({ to: "/profile" });
      })
      .catch(() => setMessage("Sign-in expired. Please try again."));
  }, [canExchange, exchangeCode, navigate, provider]);

  const label = provider === "steam" ? "Steam" : "Google";
  const displayMessage =
    validProvider && error
      ? oauthErrorMessage(provider as OAuthProvider, error)
      : !canExchange
        ? "Sign-in was cancelled or expired."
        : message;
  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-5 py-12">
      <section className="w-full rounded-2xl border border-border bg-card p-7 text-center shadow-xl">
        <p className="text-sm font-medium text-primary">Secure handoff</p>
        <h1 className="mt-2 text-3xl font-bold">{label} sign-in</h1>
        <p className="mt-4 text-muted-foreground" role="status">
          {displayMessage}
        </p>
        {!canExchange && (
          <Link
            className="mt-6 inline-block rounded-md border border-input px-4 py-2 font-semibold"
            to="/login"
          >
            Back to sign in
          </Link>
        )}
      </section>
    </main>
  );
}
