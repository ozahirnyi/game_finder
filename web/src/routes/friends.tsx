import { createFileRoute } from "@tanstack/react-router";
import { FriendsScreen } from "@/features/friends/FriendsScreen";

export const Route = createFileRoute("/friends")({
  head: () => ({ meta: [{ title: "Friends — GameFinder" }] }),
  component: FriendsScreen,
});
