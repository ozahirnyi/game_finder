import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { GameCover } from "@/components/GameCover";
import { Chip, SectionHeader } from "@/components/ui-bits";
import { games, priceHistory } from "@/lib/mockData";
import { Bell, TrendingDown } from "lucide-react";

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

function Sparkline() {
  const w = 200;
  const h = 44;
  const max = Math.max(...priceHistory.map((p) => p.price));
  const min = Math.min(...priceHistory.map((p) => p.price));
  const pts = priceHistory
    .map((p, i) => {
      const x = (i / (priceHistory.length - 1)) * w;
      const y = h - ((p.price - min) / (max - min || 1)) * h;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg width={w} height={h} className="text-primary">
      <polyline
        points={pts}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
      />
    </svg>
  );
}

function WishlistPage() {
  const wl = games.filter((g) => g.status === "Want to Play" || g.discount);
  return (
    <AppShell>
      <SectionHeader
        title="Wishlist"
        hint="14 items · 4 currently on sale"
        action={
          <button className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-bold hover:bg-white/5">
            <Bell className="size-3.5" /> Alerts via Telegram
          </button>
        }
      />

      <div className="space-y-4">
        {wl.map((g) => {
          const drop = g.discount ? true : false;
          return (
            <div
              key={g.id}
              className="grid grid-cols-1 gap-6 rounded-2xl border border-border bg-surface p-5 md:grid-cols-[auto_minmax(0,1fr)_auto_auto] md:items-center"
            >
              <GameCover
                from={g.coverFrom}
                to={g.coverTo}
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
                <p className="mt-1 text-xs text-muted-foreground">
                  {g.genres.join(" · ")} · {g.platforms.join(", ")}
                </p>
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
                {g.originalPrice && (
                  <p className="font-mono text-xs text-muted-foreground line-through">
                    ${g.originalPrice}
                  </p>
                )}
                <p className="font-mono text-2xl font-black text-primary">
                  ${g.price}
                </p>
                <button className="mt-2 rounded-md bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground">
                  View deal
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </AppShell>
  );
}
