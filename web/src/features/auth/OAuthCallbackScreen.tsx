import { useEffect, useState } from "react";
import { exchangeGoogleCode, exchangeSteamCode, setToken } from "@/lib/api";
import { consumeOAuthReturnTo } from "./auth-navigation";

type OAuthCallbackScreenProps = {
  provider?: "google" | "steam";
  exchangeCode?: string;
  returnTo?: string;
  navigate: (target: string) => void;
};

export function OAuthCallbackScreen({
  provider,
  exchangeCode,
  returnTo,
  navigate,
}: OAuthCallbackScreenProps) {
  const invalid = !provider || !exchangeCode;
  const [message, setMessage] = useState(
    invalid ? "Sign-in was cancelled or expired." : "Completing sign-in…",
  );

  useEffect(() => {
    if (invalid || !provider || !exchangeCode) return;
    let active = true;
    const exchange =
      provider === "steam" ? exchangeSteamCode : exchangeGoogleCode;
    exchange(exchangeCode)
      .then((response) => {
        if (!active) return;
        setToken(response.access_token);
        navigate(consumeOAuthReturnTo(returnTo));
      })
      .catch(() => {
        if (active) setMessage("Sign-in expired. Please try again.");
      });
    return () => {
      active = false;
    };
  }, [exchangeCode, invalid, navigate, provider, returnTo]);

  const providerName = provider === "steam" ? "Steam" : "Google";

  return (
    <main className="grid min-h-screen place-items-center bg-background px-5 py-10 text-foreground">
      <section className="w-full max-w-md rounded-3xl border border-border bg-surface p-7 text-center">
        <p className="font-mono text-xs uppercase tracking-widest text-primary">
          Secure handoff
        </p>
        <h1 className="mt-3 text-2xl font-bold">{providerName} sign-in</h1>
        <p className="mt-3 text-sm text-muted-foreground" role="status">
          {message}
        </p>
        {!message.startsWith("Completing") ? (
          <a
            className="mt-5 inline-flex rounded-lg border border-border bg-secondary px-4 py-2 text-sm font-bold"
            href="/login"
          >
            Back to sign in
          </a>
        ) : null}
      </section>
    </main>
  );
}
