import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { GameCover } from "@/components/GameCover";
import { Chip, SectionHeader } from "@/components/ui-bits";
import { games } from "@/lib/mockData";
import { Flame, Clock } from "lucide-react";

export const Route = createFileRoute("/deals")({
  head: () => ({
    meta: [
      { title: "Deals — GameFinder" },
      {
        name: "description",
        content:
          "Live discounts across storefronts, prioritized by your wishlist and friend overlap.",
      },
    ],
  }),
  component: DealsPage,
});

function DealsPage() {
  const deals = games.filter((g) => g.discount);
  const hero = deals[0];

  return (
    <AppShell>
      <SectionHeader
        title="Deals"
        hint={`${deals.length} active discounts · refreshed 2 min ago`}
      />

      {hero && (
        <div className="mb-10 grid grid-cols-1 gap-6 overflow-hidden rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/15 via-transparent to-transparent p-6 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] md:p-8">
          <div>
            <div className="mb-4 flex items-center gap-2">
              <Flame className="size-4 text-primary" />
              <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-primary">
                Deal of the day
              </span>
            </div>
            <h3 className="text-4xl font-extrabold tracking-tight">
              {hero.title}
            </h3>
            <p className="mt-3 max-w-md text-sm text-muted-foreground">
              Matches your wishlist and 3 friends already own it. Sale ends in 2
              days.
            </p>
            <div className="mt-6 flex flex-wrap items-end gap-6">
              <div>
                <p className="font-mono text-xs text-muted-foreground line-through">
                  ${hero.originalPrice}
                </p>
                <p className="font-mono text-5xl font-black text-primary">
                  ${hero.price}
                </p>
              </div>
              <Chip tone="primary">-{hero.discount}%</Chip>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="size-3.5" /> Ends in 47:12:04
              </div>
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <button className="rounded-lg bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground">
                View deal
              </button>
              <button className="rounded-lg border border-border bg-surface px-5 py-2.5 text-sm font-bold hover:bg-white/5">
                Invite friends to buy together
              </button>
            </div>
          </div>
          <GameCover
            from={hero.coverFrom}
            to={hero.coverTo}
            title={hero.title}
            className="aspect-video min-h-56 w-full rounded-2xl"
          />
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {deals.slice(1).map((g) => (
          <div
            key={g.id}
            className="group flex items-center gap-4 rounded-2xl border border-border bg-surface p-4 transition hover:border-white/20"
          >
            <GameCover
              from={g.coverFrom}
              to={g.coverTo}
              title={g.title}
              compact
              className="size-24 shrink-0 rounded-xl"
            />
            <div className="min-w-0 flex-1">
              <h4 className="truncate text-lg font-bold">{g.title}</h4>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {g.genres.join(" · ")}
              </p>
              <div className="mt-2 flex items-center gap-2">
                {g.platforms.map((p) => (
                  <Chip key={p}>{p}</Chip>
                ))}
              </div>
            </div>
            <div className="text-right">
              <Chip tone="primary">-{g.discount}%</Chip>
              <p className="mt-1 font-mono text-[10px] text-muted-foreground line-through">
                ${g.originalPrice}
              </p>
              <p className="font-mono text-lg font-black text-primary">
                ${g.price}
              </p>
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
