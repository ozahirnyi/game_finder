import { createFileRoute } from "@tanstack/react-router";
import { SearchScreen } from "@/features/discovery/SearchScreen";

export const Route = createFileRoute("/search")({
  head: () => ({ meta: [{ title: "Search — GameFinder" }] }),
  component: SearchScreen,
});
