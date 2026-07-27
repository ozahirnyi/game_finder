import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { HomeScreen } from "@/features/home/HomeScreen";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "GameFinder — Find games and deals" },
      { name: "description", content: "Search games, discover live deals, and personalize your library with Steam." },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  return <AppShell><HomeScreen /></AppShell>;
}
