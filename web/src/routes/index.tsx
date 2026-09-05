import { createFileRoute } from "@tanstack/react-router";
import { DiscoveryScreen } from "@/features/discovery/DiscoveryScreen";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Discover — GameFinder" }] }),
  component: DiscoveryScreen,
});
