import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useCallback } from "react";
import { OAuthCallbackScreen } from "@/features/auth/OAuthCallbackScreen";
import { validateInternalReturnTo } from "@/features/auth/auth-navigation";

type CallbackSearch = {
  provider?: "google" | "steam";
  exchangeCode?: string;
  returnTo?: string;
};

export const Route = createFileRoute("/auth/callback")({
  validateSearch: (search: Record<string, unknown>): CallbackSearch => ({
    provider:
      search.provider === "google" || search.provider === "steam"
        ? search.provider
        : undefined,
    exchangeCode:
      typeof search.exchange_code === "string"
        ? search.exchange_code
        : undefined,
    returnTo: validateInternalReturnTo(search.returnTo) ?? undefined,
  }),
  head: () => ({
    meta: [
      { title: "Completing sign in — PlayFinder" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OAuthCallbackPage,
});

function OAuthCallbackPage() {
  const search = Route.useSearch();
  const router = useRouter();
  const navigate = useCallback(
    (target: string) => router.history.replace(target),
    [router],
  );
  return (
    <OAuthCallbackScreen
      exchangeCode={search.exchangeCode}
      navigate={navigate}
      provider={search.provider}
      returnTo={search.returnTo}
    />
  );
}
