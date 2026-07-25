import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { exchangeGoogleCode, exchangeSteamCode, setToken } from "@/lib/api";
import { lovableQueryKeys } from "@/lib/lovable-data";

type Provider = "google" | "steam";

export const Route = createFileRoute("/auth/callback")({
  validateSearch: (search: Record<string, unknown>) => ({
    provider: typeof search.provider === "string" ? search.provider : undefined,
    exchange_code:
      typeof search.exchange_code === "string" ? search.exchange_code : undefined,
    error: typeof search.error === "string" ? search.error : undefined,
  }),
  component: AuthCallbackPage,
});

function AuthCallbackPage() {
  const { provider, exchange_code: exchangeCode, error } = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [state, setState] = useState<"loading" | "error">("loading");

  useEffect(() => {
    const selected = provider === "google" || provider === "steam" ? provider : null;
    if (error || !selected || !exchangeCode) {
      setState("error");
      return;
    }

    let active = true;
    void (async () => {
      try {
        const result = await (selected === "google"
          ? exchangeGoogleCode(exchangeCode)
          : exchangeSteamCode(exchangeCode));
        if (!active) return;
        setToken(result.access_token);
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: lovableQueryKeys.me }),
          queryClient.invalidateQueries({ queryKey: lovableQueryKeys.profileSummary }),
          queryClient.invalidateQueries({ queryKey: lovableQueryKeys.dashboard }),
        ]);
        await navigate({ to: "/profile" });
      } catch {
        if (active) setState("error");
      }
    })();
    return () => {
      active = false;
    };
  }, [error, exchangeCode, navigate, provider, queryClient]);

  if (state === "error") {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
        <h1 className="text-2xl font-extrabold">Sign-in unavailable</h1>
        <p className="text-sm text-muted-foreground">Sign-in expired. Please try again.</p>
        <Link to="/login" className="rounded-lg bg-primary px-4 py-2 font-bold text-primary-foreground">
          Go to sign in
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center justify-center px-4 text-center">
      <p className="text-sm text-muted-foreground">Completing your PlayFinder sign-in…</p>
    </main>
  );
}
