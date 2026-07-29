import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { GameCover } from "@/components/GameCover";
import { Chip, SectionHeader } from "@/components/ui-bits";
import { getWishlist } from "@/lib/api";
import { Bell, TrendingDown } from "lucide-react";

export const Route = createFileRoute("/wishlist")({
  head: () => ({
    meta: [
      { title: "Wishlist — Playfinder" },
      {
        name: "description",
        content: "Track wishlist items with live price history and Telegram drop alerts.",
      },
    ],
  }),
  component: WishlistPage,
});

function Sparkline() {
  return (
    <span className="font-mono text-xs text-muted-foreground">Live price check available</span>
  );
}

function WishlistPage() {
  const wishlistQuery = useQuery({ queryKey: ["wishlist"], queryFn: getWishlist });
  const wl = wishlistQuery.data ?? [];
  return (
    <AppShell>
      <SectionHeader
        title="Wishlist"
        hint={`${wl.length} saved items`}
        action={
          <button className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-bold hover:bg-foreground/5">
            <Bell className="size-3.5" /> Alerts via Telegram
          </button>
        }
      />

      <div className="stagger space-y-4">
        {wl.map((g) => {
          const drop = false;
          return (
            <Link
              key={g.id}
              to="/games/$gameId"
              params={{ gameId: String(g.catalog_game_id) }}
              className="hover-lift grid grid-cols-1 gap-6 rounded-2xl border border-border bg-surface p-5 hover:border-primary/40 md:grid-cols-[auto_minmax(0,1fr)_auto_auto] md:items-center"
            >
              <GameCover
                from="#c75f28"
                to="#22243a"
                image={g.cover_url}
                title={g.title}
                compact
                className="size-20 rounded-lg"
              />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="truncate text-lg font-bold">{g.title}</h4>
                  {drop && (
                    <Chip tone="primary">
                      <TrendingDown className="mr-1 size-3" /> Lowest ever
                    </Chip>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Saved from the live catalogue</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {drop
                    ? "3 friends also have this in wishlist."
                    : "Not yet released · Notify on launch."}
                </p>
              </div>
              <div>
                <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  Price · 6mo
                </p>
                <Sparkline />
              </div>
              <div className="text-right">
                <p className="font-mono text-2xl font-black text-primary">Track price</p>
                <span className="mt-2 inline-block rounded-md bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground">
                  View details
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </AppShell>
  );
}
