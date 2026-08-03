import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { WishlistScreen } from "@/features/library/WishlistScreen";

export const Route = createFileRoute("/wishlist")({ component: WishlistRoute });

function WishlistRoute() {
  return <AppShell><WishlistScreen /></AppShell>;
}
