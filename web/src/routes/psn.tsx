import { createFileRoute } from "@tanstack/react-router";
import { PsnScreen } from "@/features/integrations/PsnScreen";

export const Route = createFileRoute("/psn")({
  head: () => ({ meta: [{ title: "PlayStation — GameFinder" }] }),
  component: PsnScreen,
});
