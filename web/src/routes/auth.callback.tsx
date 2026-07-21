import { createFileRoute } from "@tanstack/react-router";
import { OAuthCallbackScreen } from "@/features/auth/OAuthCallbackScreen";

export const Route = createFileRoute("/auth/callback")({
  component: OAuthCallbackRoute,
});

function OAuthCallbackRoute() {
  const search = Route.useSearch() as {
    provider?: string;
    exchange_code?: string;
    error?: string;
  };
  return (
    <OAuthCallbackScreen
      provider={search.provider}
      exchangeCode={search.exchange_code}
      error={search.error}
    />
  );
}
