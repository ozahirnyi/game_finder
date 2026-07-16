import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { GameCover } from "@/components/GameCover";
import { Chip, SectionHeader } from "@/components/ui-bits";
import { Bell, TrendingDown } from "lucide-react";
import { isAuthenticated, listSavedGames } from "@/lib/api";
import { lovableQueryKeys, toSavedGameCard } from "@/lib/lovable-data";

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
  const pts = "";
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

export function WishlistPage() {
  const signedIn = isAuthenticated();
  const { data: savedGames = [], isError } = useQuery({
    queryKey: lovableQueryKeys.savedGames,
    queryFn: listSavedGames,
    enabled: signedIn,
  });
  const wl = savedGames
    .map(toSavedGameCard)
    .filter((game) =>
      /wishlist/i.test(`${game.notes ?? ""}\n${game.info ?? ""}`),
    );
  return (
    <AppShell>
      <SectionHeader
        title="Wishlist"
        hint={`${wl.length} wishlist items marked in your saved-game notes or info`}
        action={
          <button className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-bold hover:bg-white/5">
            <Bell className="size-3.5" /> Alerts via Telegram
          </button>
        }
      />
      <div className="space-y-4">
        {!signedIn ? (
          <div className="grid grid-cols-1 gap-6 rounded-2xl border border-border bg-surface p-5 md:grid-cols-[auto_minmax(0,1fr)_auto_auto] md:items-center">
            Sign in to view your wishlist
          </div>
        ) : isError ? (
          <div className="grid grid-cols-1 gap-6 rounded-2xl border border-border bg-surface p-5 md:grid-cols-[auto_minmax(0,1fr)_auto_auto] md:items-center">
            Data unavailable
          </div>
        ) : (
          wl.map((g) => {
            const drop = false;
            return (
              <div
                key={g.id}
                className="grid grid-cols-1 gap-6 rounded-2xl border border-border bg-surface p-5 md:grid-cols-[auto_minmax(0,1fr)_auto_auto] md:items-center"
              >
                <GameCover
                  from="#14b8a6"
                  to="#0f172a"
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
                    Data unavailable
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Data unavailable
                  </p>
                </div>
                <div>
                  <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    Data unavailable
                  </p>
                  <Sparkline />
                </div>
                <div className="text-right">
                  {drop && (
                    <p className="font-mono text-xs text-muted-foreground line-through">
                      Data unavailable
                    </p>
                  )}
                  <p className="font-mono text-2xl font-black text-primary">
                    Data unavailable
                  </p>
                  <button className="mt-2 rounded-md bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground">
                    View deal
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </AppShell>
  );
}
