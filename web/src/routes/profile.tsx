import { createFileRoute } from "@tanstack/react-router";
import { ProfileScreen } from "@/features/integrations/ProfileScreen";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "Profile — GameFinder" }] }),
  component: ProfileScreen,
});
