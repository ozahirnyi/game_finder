import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Clock } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { GameCover } from "@/components/GameCover";
import { Chip, SectionHeader } from "@/components/ui-bits";
import { getGenreDeals, type HomeDeal } from "@/lib/api";
import { lovableQueryKeys } from "@/lib/lovable-data";

export const Route = createFileRoute("/deals")({
  head: () => ({
    meta: [
      { title: "Deals — PlayFinder" },
      {
        name: "description",
        content: "Current discounted Steam bestsellers and genre-based deals.",
      },
    ],
  }),
  component: DealsPage,
});

function money(amount: number | undefined, currency: string | undefined) {
  return amount === undefined || !currency
    ? "Price not listed"
    : new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount);
}

function DealLinks({ deal, compact = false }: { deal: HomeDeal; compact?: boolean }) {
  const buttonClass = compact
    ? "rounded-md bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground transition hover:opacity-90"
    : "rounded-lg bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground transition hover:opacity-90";
  const catalogClass = compact
    ? "rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-bold transition hover:bg-white/5"
    : "rounded-lg border border-border bg-surface px-5 py-2.5 text-sm font-bold transition hover:bg-white/5";
  return (
    <div className={compact ? "mt-3 flex flex-wrap gap-2" : "mt-8 flex flex-wrap gap-3"}>
      {deal.url ? (
        <a
          href={deal.url}
          target="_blank"
          rel="noreferrer"
          className={buttonClass}
        >
          Open deal
        </a>
      ) : (
        <span className="px-1 text-xs text-muted-foreground">The store has not supplied a purchase link.</span>
      )}
      {deal.id ? (
        <Link
          to="/games/$gameId"
          params={{ gameId: String(deal.id) }}
          className={catalogClass}
        >
          Game details
        </Link>
      ) : (
        <span className="px-1 text-xs text-muted-foreground">Catalog details are being matched.</span>
      )}
    </div>
  );
}

function DealPrices({ deal, compact = false }: { deal: HomeDeal; compact?: boolean }) {
  return (
    <div className={compact ? "flex flex-wrap items-end gap-3" : "flex flex-wrap items-end gap-5"}>
      <div>
        {deal.current?.regular && (
          <p className="font-mono text-xs text-muted-foreground line-through">
            {money(deal.current.regular.amount, deal.current.regular.currency)}
          </p>
        )}
        <p className={compact ? "font-mono text-xl font-black text-primary" : "font-mono text-3xl font-black text-primary"}>
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

function DealCard({ deal }: { deal: HomeDeal }) {
  return (
    <article className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3 transition hover:border-white/20">
      <GameCover
        from={deal.background_image ?? "#0f172a"}
        to="#0f172a"
        title={deal.name}
        compact
        className="size-20 shrink-0 rounded-lg"
      />
      <div className="min-w-0 flex-1">
        {deal.id ? (
          <Link
            to="/games/$gameId"
            params={{ gameId: String(deal.id) }}
            className="block truncate text-base font-bold hover:text-primary"
          >
            {deal.name}
          </Link>
        ) : (
          <h4 className="truncate text-base font-bold">{deal.name}</h4>
        )}
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          {deal.released ? `Released ${deal.released}` : "Release date is not listed."}
        </p>
        <div className="mt-2"><DealPrices deal={deal} compact /></div>
        <DealLinks deal={deal} compact />
      </div>
    </article>
  );
}

export function DealsPage() {
  const dealsQuery = useQuery({
    queryKey: lovableQueryKeys.genreDeals,
    queryFn: getGenreDeals,
  });
  const popular = dealsQuery.data?.popular ?? [];
  const sections = dealsQuery.data?.sections ?? [];

  return (
    <AppShell>
      <SectionHeader
        title="Deals"
        hint={dealsQuery.isLoading ? "Loading current deals…" : `${popular.length} popular Steam deals`}
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

      {dealsQuery.isSuccess && !popular.length && !sections.length && (
        <div className="rounded-2xl border border-border bg-surface p-6 text-sm text-muted-foreground">
          There are no featured price drops for this region yet. Check back soon.
        </div>
      )}

      {popular.length ? (
        <section className="mb-10">
          <SectionHeader title="Popular on Steam" hint="Discounted bestsellers" />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {popular.map((deal) => <DealCard deal={deal} key={`popular-${deal.id ?? deal.name}`} />)}
          </div>
        </section>
      ) : null}

      <div className="space-y-10">
        {sections.map((section) => (
          <section key={section.genre}>
            <SectionHeader title={section.genre} hint="Current discounts" />
            {section.results.length ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {section.results.map((deal) => (
                  <DealCard deal={deal} key={`${section.genre}-${deal.id ?? deal.name}`} />
                ))}
              </div>
            ) : (
              <p className="rounded-2xl border border-border bg-surface p-4 text-sm text-muted-foreground">
                No matching current deals.
              </p>
            )}
          </section>
        ))}
      </div>
    </AppShell>
  );
}
