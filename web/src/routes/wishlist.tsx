import { createFileRoute } from "@tanstack/react-router";
import { WishlistScreen } from "@/features/library/WishlistScreen";

export const Route = createFileRoute("/wishlist")({
  head: () => ({ meta: [{ title: "Wishlist — GameFinder" }] }),
  component: WishlistScreen,
});
