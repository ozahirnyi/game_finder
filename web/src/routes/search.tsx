import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { AppShell } from "@/components/AppShell";
import { SearchScreen } from "@/features/discovery/SearchScreen";

export const Route = createFileRoute("/search")({
  validateSearch: z.object({ q: z.string().optional() }),
  component: SearchPage,
});
function SearchPage() {
  const { q = "" } = Route.useSearch();
  const navigate = useNavigate();
  return (
    <AppShell>
      <SearchScreen
        initialQuery={q}
        onQueryChange={(next) =>
          void navigate({ to: "/search", search: { q: next } })
        }
      />
    </AppShell>
  );
}
