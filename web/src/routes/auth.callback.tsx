import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ApiError, exchangeGoogleCode, exchangeSteamCode, setToken } from "@/lib/api";

export const Route = createFileRoute("/auth/callback")({ component: AuthCallback });

function AuthCallback() {
  const navigate = Route.useNavigate();
  const search = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const provider = search.get("provider");
    const exchangeCode = search.get("exchange_code");
    const providerError = search.get("error");
    if (providerError || !exchangeCode || (provider !== "google" && provider !== "steam")) {
      setError(providerError ?? "Invalid sign-in result.");
      return;
    }
    (provider === "google" ? exchangeGoogleCode(exchangeCode) : exchangeSteamCode(exchangeCode))
      .then(({ access_token }) => {
        setToken(access_token);
        return navigate({ to: "/account" });
      })
      .catch((reason) => setError(reason instanceof ApiError ? reason.message : "Sign-in failed."));
  }, [navigate, search]);
  return (
    <main className="grid min-h-screen place-items-center p-6">
      <p className={error ? "text-destructive" : "text-muted-foreground"}>
        {error ?? "Completing sign-in…"}
      </p>
    </main>
  );
}
