import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { GameCover } from "@/components/GameCover";
import { Chip, EmptyState, SectionHeader } from "@/components/ui-bits";
import { type Deal, getGenreDeals } from "@/lib/api";

export const Route = createFileRoute("/deals")({
  head: () => ({ meta: [{ title: "Deals — Playfinder" }, { name: "description", content: "Live Steam discounts organized around your gaming tastes." }] }),
  component: DealsPage,
});

function gameLink(deal: Deal) {
  return deal.id != null
    ? { params: { gameId: String(deal.id) }, search: { title: deal.name } }
    : deal.steam_appid != null
      ? { params: { gameId: String(deal.steam_appid) }, search: { source: "steam" as const, title: deal.name } }
      : null;
}

function DealCard({ deal }: { deal: Deal }) {
  const link = gameLink(deal);
  const content = <div className="hover-lift group flex h-full items-center gap-4 rounded-2xl border border-border bg-surface p-4 hover:border-primary/40">
    <GameCover from="#dc2626" to="#111827" title={deal.name} image={deal.background_image ?? undefined} compact className="size-20 shrink-0 rounded-xl" />
    <div className="min-w-0 flex-1"><h3 className="truncate text-base font-bold group-hover:text-primary">{deal.name}</h3><div className="mt-2 flex flex-wrap items-center gap-2"><Chip>{deal.current?.shop ?? "Store"}</Chip>{deal.current?.url && <a href={deal.current.url} target="_blank" rel="noreferrer" className="text-xs font-bold text-primary hover:underline">Open in {deal.current.shop ?? "store"}</a>}</div></div>
    <div className="text-right">{deal.current?.cut != null && <Chip tone="primary">-{deal.current.cut}%</Chip>}<p className="mt-1 font-mono text-[10px] text-muted-foreground line-through">{deal.current?.regular ? `${deal.current.regular.currency} ${deal.current.regular.amount}` : "—"}</p><p className="font-mono text-lg font-black text-primary">{deal.current?.price ? `${deal.current.price.currency} ${deal.current.price.amount}` : "—"}</p></div>
  </div>;
  return link ? <Link to="/games/$gameId" {...link} aria-label={`Open ${deal.name} on Playfinder`}>{content}</Link> : content;
}

function DealSection({ title, deals }: { title: string; deals: Deal[] }) {
  return <section className="mb-10"><SectionHeader title={title} hint={`${deals.length} discounts`} /><div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">{deals.slice(0, title === "Popular on Steam" ? 4 : 5).map((deal) => <DealCard key={`${deal.id ?? deal.steam_appid ?? deal.name}`} deal={deal} />)}</div></section>;
}

function DealsPage() {
  const dealsQuery = useQuery({ queryKey: ["genre-deals"], queryFn: getGenreDeals });
  if (dealsQuery.isPending) return <AppShell><SectionHeader title="Deals" /><p className="text-sm text-muted-foreground">Loading Steam discounts…</p></AppShell>;
  if (dealsQuery.isError) return <AppShell><EmptyState title="Deals are unavailable" description="Please try again shortly." action={<button onClick={() => dealsQuery.refetch()} className="rounded-lg border border-border px-4 py-2 text-sm font-bold">Retry</button>} /></AppShell>;
  const data = dealsQuery.data;
  if (!data || (!data.popular.length && !data.sections.some((section) => section.results.length))) return <AppShell><EmptyState title="No active deals" description="Check back soon for new Steam discounts." /></AppShell>;
  return <AppShell><SectionHeader title="Deals" hint="Steam discounts picked for you" /><DealSection title="Popular on Steam" deals={data.popular} />{data.sections.slice(0, 5).map((section) => <DealSection key={section.genre} title={section.genre} deals={section.results} />)}</AppShell>;
}
