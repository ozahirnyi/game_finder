import { createFileRoute } from "@tanstack/react-router";
import { LibraryScreen } from "@/features/library/LibraryScreen";

export const Route = createFileRoute("/library")({
  head: () => ({ meta: [{ title: "Library — GameFinder" }] }),
  component: LibraryScreen,
});
