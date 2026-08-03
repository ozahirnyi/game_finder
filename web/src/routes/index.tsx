import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { DiscoveryScreen } from "@/features/discovery/DiscoveryScreen";

export const Route = createFileRoute("/")({ component: HomeRoute });

function HomeRoute() {
  return <AppShell><DiscoveryScreen /></AppShell>;
}
