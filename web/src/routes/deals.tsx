import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Clock, Flame } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { GameCover } from "@/components/GameCover";
import { Chip, SectionHeader } from "@/components/ui-bits";
import { getHomepageDeals, type HomeDeal } from "@/lib/api";
import { lovableQueryKeys } from "@/lib/lovable-data";

export const Route = createFileRoute("/deals")({
  head: () => ({
    meta: [
      { title: "Deals — GameFinder" },
      {
        name: "description",
        content: "Public game deals and discounts across storefronts.",
      },
    ],
  }),
  component: DealsPage,
});

function money(amount: number | undefined, currency: string | undefined) {
  return amount === undefined || !currency
    ? "Price not listed"
    : new Intl.NumberFormat(undefined, { style: "currency", currency }).format(
        amount,
      );
}

function DealLinks({
  deal,
  compact = false,
}: {
  deal: HomeDeal;
  compact?: boolean;
}) {
  return (
    <div
      className={
        compact ? "mt-3 flex flex-wrap gap-2" : "mt-8 flex flex-wrap gap-3"
      }
    >
      {deal.url ? (
        <a
          href={deal.url}
          target="_blank"
          rel="noreferrer"
          className="rounded-lg bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground transition hover:opacity-90"
        >
          Open deal
        </a>
      ) : (
        <span className="px-1 text-xs text-muted-foreground">
          The store has not supplied a purchase link.
        </span>
      )}
      {deal.id ? (
        <Link
          to="/games/$gameId"
          params={{ gameId: String(deal.id) }}
          className="rounded-lg border border-border bg-surface px-5 py-2.5 text-sm font-bold transition hover:bg-white/5"
        >
          Game details
        </Link>
      ) : (
        <span className="px-1 text-xs text-muted-foreground">
          Catalog details are being matched.
        </span>
      )}
    </div>
  );
}

function DealPrices({ deal }: { deal: HomeDeal }) {
  return (
    <div className="flex flex-wrap items-end gap-5">
      <div>
        {deal.current?.regular && (
          <p className="font-mono text-xs text-muted-foreground line-through">
            {money(deal.current.regular.amount, deal.current.regular.currency)}
          </p>
        )}
        <p className="font-mono text-3xl font-black text-primary">
          {money(deal.current?.price?.amount, deal.current?.price?.currency)}
        </p>
      </div>
      {deal.current?.cut !== null && deal.current?.cut !== undefined && (
        <Chip tone="primary">-{deal.current.cut}%</Chip>
      )}
      {deal.current?.shop && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="size-3.5" /> {deal.current.shop}
        </div>
      )}
    </div>
  );
}

export function DealsPage() {
  const dealsQuery = useQuery({
    queryKey: lovableQueryKeys.deals("US"),
    queryFn: () => getHomepageDeals("US", 7),
  });
  const deals = dealsQuery.data?.results ?? [];
  const hero = deals[0];

  return (
    <AppShell>
      <SectionHeader
        title="Deals"
        hint={
          dealsQuery.isLoading
            ? "Loading current deals…"
            : `${deals.length} current deals`
        }
      />

      {dealsQuery.isError && (
        <div className="mb-6 rounded-xl border border-border bg-surface p-4 text-sm text-muted-foreground">
          <p>Deals could not be loaded right now.</p>
          <button
            className="mt-3 rounded-md border border-border px-3 py-1.5 text-xs font-bold hover:text-foreground"
            onClick={() => dealsQuery.refetch()}
          >
            Retry
          </button>
        </div>
      )}

      {dealsQuery.isSuccess && !hero && (
        <div className="rounded-2xl border border-border bg-surface p-6 text-sm text-muted-foreground">
          There are no featured price drops for this region yet. Check back
          soon.
        </div>
      )}

      {hero && (
        <section className="mb-10 grid grid-cols-1 gap-6 overflow-hidden rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/15 via-transparent to-transparent p-6 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] md:p-8">
          <div>
            <div className="mb-4 flex items-center gap-2">
              <Flame className="size-4 text-primary" />
              <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-primary">
                Featured deal
              </span>
            </div>
            <h3 className="text-4xl font-extrabold tracking-tight">
              {hero.name}
            </h3>
            <p className="mt-3 max-w-md text-sm text-muted-foreground">
              {hero.released
                ? `Released ${hero.released}`
                : "Release date is not listed."}
            </p>
            <div className="mt-6">
              <DealPrices deal={hero} />
            </div>
            <DealLinks deal={hero} />
          </div>
          <GameCover
            from={hero.background_image ?? "#0f172a"}
            to="#0f172a"
            title={hero.name}
            className="aspect-video min-h-56 w-full rounded-2xl"
          />
        </section>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {deals.slice(1).map((deal) => (
          <article
            key={`${deal.id ?? deal.name}-${deal.url ?? "deal"}`}
            className="flex items-center gap-4 rounded-2xl border border-border bg-surface p-4 transition hover:border-white/20"
          >
            <GameCover
              from={deal.background_image ?? "#0f172a"}
              to="#0f172a"
              title={deal.name}
              compact
              className="size-24 shrink-0 rounded-xl"
            />
            <div className="min-w-0 flex-1">
              {deal.id ? (
                <Link
                  to="/games/$gameId"
                  params={{ gameId: String(deal.id) }}
                  className="block truncate text-lg font-bold hover:text-primary"
                >
                  {deal.name}
                </Link>
              ) : (
                <h4 className="truncate text-lg font-bold">{deal.name}</h4>
              )}
              <p className="mt-0.5 text-xs text-muted-foreground">
                {deal.released
                  ? `Released ${deal.released}`
                  : "Release date is not listed."}
              </p>
              <div className="mt-3">
                <DealPrices deal={deal} />
              </div>
              <DealLinks deal={deal} compact />
            </div>
          </article>
        ))}
      </div>
    </AppShell>
  );
}
