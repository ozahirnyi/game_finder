import { createFileRoute } from "@tanstack/react-router";
import { DealsScreen } from "@/features/discovery/DealsScreen";

export const Route = createFileRoute("/deals")({
  head: () => ({ meta: [{ title: "Deals — GameFinder" }] }),
  component: DealsScreen,
});
