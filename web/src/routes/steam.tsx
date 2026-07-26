import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { SteamLibraryPanel } from "@/features/library/SteamLibraryPanel";

export const Route = createFileRoute("/steam")({
  validateSearch: (search: Record<string, unknown>) => ({
    linked: search.linked === "1" ? "1" : undefined,
    error: typeof search.error === "string" ? search.error : undefined,
  }),
  component: SteamPage,
});

function SteamPage() {
  const search = Route.useSearch();

  return (
    <AppShell>
      <SteamLibraryPanel linked={search.linked} error={search.error} />
    </AppShell>
  );
}
