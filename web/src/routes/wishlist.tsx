import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { GameCover } from "@/components/GameCover";
import { EmptyState, PriceBlock, SectionHeader } from "@/components/ui-bits";
import { games } from "@/lib/mockData";
import { Bell, Heart, Trash2 } from "lucide-react";

export const Route = createFileRoute("/wishlist")({
  head: () => ({
    meta: [
      { title: "Wishlist — Playfinder" },
      {
        name: "description",
        content:
          "Track the games you want and get alerted the moment their price drops in your region.",
      },
      { property: "og:title", content: "Wishlist — Playfinder" },
      {
        property: "og:description",
        content: "Your saved games with live prices and drop alerts.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: WishlistPage,
});

function WishlistPage() {
  const [removed, setRemoved] = useState<string[]>([]);

  const all = games.filter((g) => g.status === "Want to Play" || g.discount);
  const wl = all.filter((g) => !removed.includes(g.id));

  return (
    <AppShell>
      <SectionHeader
        title="Wishlist"
        hint="Games you're waiting on, with live pricing"
        action={
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-bold hover:bg-foreground/5">
              <Bell className="size-3.5" /> Price alerts
            </button>
          </div>
        }
      />

      {wl.length === 0 && (
        <EmptyState
          icon={<Heart className="size-5" />}
          title="Your wishlist is empty"
          description="Add games you're waiting on and we'll track their price for you."
          action={
            <Link
              to="/search"
              className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
            >
              Browse games
            </Link>
          }
        />
      )}

      {wl.length > 0 && (
        <div className="stagger space-y-4">
          {wl.map((g) => (
            <div
              key={g.id}
              className="hover-lift grid grid-cols-1 gap-6 rounded-2xl border border-border bg-surface p-5 hover:border-primary/40 md:grid-cols-[auto_minmax(0,1fr)_auto_auto] md:items-center"
            >
              <Link to="/games/$gameId" params={{ gameId: g.id }}>
                <GameCover
                  from={g.coverFrom}
                  to={g.coverTo}
                  title={g.title}
                  image={g.coverUrl}
                  compact
                  bare
                  className="size-20 rounded-lg"
                />
              </Link>
              <div className="min-w-0">
                <Link
                  to="/games/$gameId"
                  params={{ gameId: g.id }}
                  className="truncate text-lg font-bold transition-colors hover:text-primary"
                >
                  {g.title}
                </Link>
                <p className="mt-1 text-xs text-muted-foreground">
                  {g.genres.join(" · ")} · {g.platforms.join(", ")}
                </p>
              </div>
              <PriceBlock
                price={g.price}
                originalPrice={g.originalPrice}
                discount={g.discount}
                currency={g.currency}
                store={g.store}
              />
              <div className="flex items-center justify-end gap-2">
                <Link
                  to="/games/$gameId"
                  params={{ gameId: g.id }}
                  className="rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground"
                >
                  View game
                </Link>
                <button
                  aria-label={`Remove ${g.title} from wishlist`}
                  onClick={() => setRemoved((r) => [...r, g.id])}
                  className="grid size-9 place-items-center rounded-lg border border-border text-muted-foreground transition hover:border-destructive/50 hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
