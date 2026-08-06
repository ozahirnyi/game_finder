import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { WishlistScreen } from "@/features/retention/WishlistScreen";

export const Route = createFileRoute("/wishlist")({
  head: () => ({
    meta: [
      { title: "Wishlist — GameFinder" },
      {
        name: "description",
        content:
          "Track wishlist items with live price history and Telegram drop alerts.",
      },
    ],
  }),
  component: WishlistPage,
});

function WishlistPage() {
  return (
    <AppShell>
      <WishlistScreen />
    </AppShell>
  );
}
