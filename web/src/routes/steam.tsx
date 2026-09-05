import { createFileRoute } from "@tanstack/react-router";
import { SteamScreen } from "@/features/integrations/SteamScreen";

export const Route = createFileRoute("/steam")({
  head: () => ({ meta: [{ title: "Steam — GameFinder" }] }),
  component: SteamScreen,
});
