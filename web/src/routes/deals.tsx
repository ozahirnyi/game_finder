import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { GameCover } from "@/components/GameCover";
import { Chip, SectionHeader } from "@/components/ui-bits";
import { getHomepageDeals } from "@/lib/api";
import { lovableQueryKeys } from "@/lib/lovable-data";
import { useQuery } from "@tanstack/react-query";
import { Flame, Clock } from "lucide-react";

export const Route = createFileRoute("/deals")({
  head: () => ({
    meta: [
      { title: "Deals — GameFinder" },
      { name: "description", content: "Live discounts across storefronts, prioritized by your wishlist and friend overlap." },
    ],
  }),
  component: DealsPage,
});

function money(amount: number | undefined, currency: string | undefined) {
  return amount === undefined || !currency ? "Data unavailable" : new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount);
}

export function DealsPage() {
  const dealsQuery = useQuery({
    queryKey: lovableQueryKeys.deals("US"),
    queryFn: () => getHomepageDeals("US", 6),
  });
  const deals = dealsQuery.data?.results ?? [];
  const hero = deals[0];

  return (
    <AppShell>
      <SectionHeader
        title="Deals"
        hint={dealsQuery.isSuccess ? `${deals.length} results` : "Data unavailable"}
      />

      {dealsQuery.isError && (
        <div className="mb-6 rounded-xl border border-border bg-surface p-4 text-sm text-muted-foreground">
          <p>Failed to load deals.</p>
          <button className="mt-3 rounded-md border border-border px-3 py-1.5 text-xs font-bold text-muted-foreground hover:text-foreground" onClick={() => dealsQuery.refetch()}>
            Retry
          </button>
        </div>
      )}

      {hero && (
        <div className="mb-10 grid grid-cols-1 gap-6 overflow-hidden rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/15 via-transparent to-transparent p-6 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] md:p-8">
          <div>
            <div className="mb-4 flex items-center gap-2">
              <Flame className="size-4 text-primary" />
              <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-primary">
                Data unavailable
              </span>
            </div>
            <h3 className="text-4xl font-extrabold tracking-tight">
              {hero.name ?? "Data unavailable"}
            </h3>
            <p className="mt-3 max-w-md text-sm text-muted-foreground">
              {hero.released ?? "Data unavailable"}
            </p>
            <div className="mt-6 flex flex-wrap items-end gap-6">
              <div>
                <p className="font-mono text-xs text-muted-foreground line-through">
                  {money(hero.current?.regular?.amount, hero.current?.regular?.currency)}
                </p>
                <p className="font-mono text-5xl font-black text-primary">
                  {money(hero.current?.price?.amount, hero.current?.price?.currency)}
                </p>
              </div>
              <Chip tone="primary">{hero.current?.cut === null || hero.current?.cut === undefined ? "Data unavailable" : `-${hero.current.cut}%`}</Chip>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="size-3.5" /> {hero.current?.shop ?? "Data unavailable"}
              </div>
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <button className="rounded-lg bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground">
                {hero.url ? "View deal" : "Data unavailable"}
              </button>
              <button className="rounded-lg border border-border bg-surface px-5 py-2.5 text-sm font-bold hover:bg-white/5">
                Data unavailable
              </button>
            </div>
          </div>
          <GameCover
            from={hero.background_image ?? "Data unavailable"}
            to={hero.background_image ?? "Data unavailable"}
            title={hero.name ?? "Data unavailable"}
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
              from={g.background_image ?? "Data unavailable"}
              to={g.background_image ?? "Data unavailable"}
              title={g.name ?? "Data unavailable"}
              compact
              className="size-24 shrink-0 rounded-xl"
            />
            <div className="min-w-0 flex-1">
              <h4 className="truncate text-lg font-bold">{g.name ?? "Data unavailable"}</h4>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {g.released ?? "Data unavailable"}
              </p>
              <div className="mt-2 flex items-center gap-2">
                <Chip>{g.current?.shop ?? "Data unavailable"}</Chip>
              </div>
            </div>
            <div className="text-right">
              <Chip tone="primary">{g.current?.cut === null || g.current?.cut === undefined ? "Data unavailable" : `-${g.current.cut}%`}</Chip>
              <p className="mt-1 font-mono text-[10px] text-muted-foreground line-through">
                {money(g.current?.regular?.amount, g.current?.regular?.currency)}
              </p>
              <p className="font-mono text-lg font-black text-primary">
                {money(g.current?.price?.amount, g.current?.price?.currency)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
