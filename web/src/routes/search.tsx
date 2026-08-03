import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { SearchScreen } from "@/features/discovery/SearchScreen";

export const Route = createFileRoute("/search")({ component: SearchRoute });
function SearchRoute() {
  const { q = "" } = Route.useSearch() as { q?: string };
  return <AppShell><SearchScreen initialQuery={q} /></AppShell>;
}
