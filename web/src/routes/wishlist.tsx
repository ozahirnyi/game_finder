import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { GameCover } from "@/components/GameCover";
import { Chip, SectionHeader } from "@/components/ui-bits";
import { addFavorite, addWishlistItem, createPriceAlert, getGamePriceHistory, isAuthenticated, listFavorites, listPriceAlerts, listWishlist, removeFavorite, removeWishlistItem, searchGames, type CatalogCollectionItem, type PriceAlert } from "@/lib/api";
import { Bell, Heart, Search, TrendingDown, X } from "lucide-react";

export const Route = createFileRoute("/wishlist")({
  head: () => ({ meta: [{ title: "Wishlist — GameFinder" }, { name: "description", content: "Your saved catalog games and price alerts." }] }),
  component: WishlistPage,
});

const wishlistKey = ["collections", "wishlist"] as const;
const favoriteKey = ["collections", "favorites"] as const;
const alertsKey = ["collections", "price-alerts"] as const;

function money(amount: { amount: number; currency: string } | null | undefined) {
  return amount ? new Intl.NumberFormat(undefined, { style: "currency", currency: amount.currency }).format(amount.amount) : "Price not listed";
}

function WishlistCard({ item, alert, onRemove, onAlert }: { item: CatalogCollectionItem; alert?: PriceAlert; onRemove: () => void; onAlert: () => void }) {
  const priceQuery = useQuery({ queryKey: ["wishlist", "price", item.catalog_game_id], queryFn: () => getGamePriceHistory(String(item.catalog_game_id)) });
  const price = priceQuery.data;
  const storeUrl = price?.current?.url ?? price?.url;
  return <article className="grid grid-cols-1 gap-5 rounded-2xl border border-border bg-surface p-5 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center"><GameCover from={item.cover_url ?? "#0f172a"} to="#0f172a" title={item.title} compact className="size-20 rounded-lg" /><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><Link to="/games/$gameId" params={{ gameId: String(item.catalog_game_id) }} className="truncate text-lg font-bold hover:text-primary">{item.title}</Link>{price?.history_low_all && price.current?.price && price.current.price.amount <= price.history_low_all.amount && <Chip tone="primary"><TrendingDown className="mr-1 size-3" />Lowest recorded</Chip>}</div><p className="mt-1 text-xs text-muted-foreground">{priceQuery.isLoading ? "Loading current price…" : priceQuery.isError ? "Price information is temporarily unavailable." : price?.current?.shop ? `Current offer at ${price.current.shop}` : "No current storefront offer was returned."}</p><div className="mt-2 flex flex-wrap gap-2">{alert ? <Chip tone="primary">Alert: {alert.target_price ? `under ${alert.target_price}` : `-${alert.target_discount}%`}</Chip> : <button onClick={onAlert} className="text-xs font-bold text-primary hover:underline"><Bell className="mr-1 inline size-3.5" />Set price alert</button>}</div></div><div className="flex flex-wrap items-center gap-3 md:justify-end"><div className="text-right"><p className="font-mono text-2xl font-black text-primary">{money(price?.current?.price)}</p>{price?.current?.regular && <p className="font-mono text-xs text-muted-foreground line-through">{money(price.current.regular)}</p>}</div>{storeUrl && <a href={storeUrl} target="_blank" rel="noreferrer" className="rounded-md bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground">View deal</a>}<button onClick={onRemove} aria-label={`Remove ${item.title}`} className="rounded-md border border-border p-2 text-muted-foreground"><X className="size-3.5" /></button></div></article>;
}

export function WishlistPage() {
  const signedIn = isAuthenticated();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [alertItem, setAlertItem] = useState<CatalogCollectionItem | null>(null);
  const [targetPrice, setTargetPrice] = useState("");
  const [targetDiscount, setTargetDiscount] = useState("");
  const wishlistQuery = useQuery({ queryKey: wishlistKey, queryFn: listWishlist, enabled: signedIn });
  const favoritesQuery = useQuery({ queryKey: favoriteKey, queryFn: listFavorites, enabled: signedIn });
  const alertsQuery = useQuery({ queryKey: alertsKey, queryFn: listPriceAlerts, enabled: signedIn });
  const catalogQuery = useQuery({ queryKey: ["wishlist", "catalog-search", search], queryFn: () => searchGames(search), enabled: signedIn && search.trim().length >= 2 });
  const refresh = () => Promise.all([queryClient.invalidateQueries({ queryKey: wishlistKey }), queryClient.invalidateQueries({ queryKey: favoriteKey }), queryClient.invalidateQueries({ queryKey: alertsKey })]);
  const addWish = useMutation({ mutationFn: ({ id, title, cover }: { id: number; title: string; cover?: string | null }) => addWishlistItem(id, title, cover), onSuccess: refresh });
  const addFav = useMutation({ mutationFn: ({ id, title, cover }: { id: number; title: string; cover?: string | null }) => addFavorite(id, title, cover), onSuccess: refresh });
  const removeWish = useMutation({ mutationFn: (id: number) => removeWishlistItem(id), onSuccess: refresh });
  const removeFav = useMutation({ mutationFn: (id: number) => removeFavorite(id), onSuccess: refresh });
  const addAlert = useMutation({ mutationFn: ({ id, price, discount }: { id: number; price?: number; discount?: number }) => createPriceAlert(id, price, discount), onSuccess: async () => { setAlertItem(null); setTargetPrice(""); setTargetDiscount(""); await queryClient.invalidateQueries({ queryKey: alertsKey }); } });
  const submitAlert = (event: FormEvent) => { event.preventDefault(); const price = Number(targetPrice) || undefined; const discount = Number(targetDiscount) || undefined; if (alertItem && (price || discount)) addAlert.mutate({ id: alertItem.catalog_game_id, price, discount }); };
  const alertByGame = new Map((alertsQuery.data ?? []).map((alert) => [alert.wishlist_catalog_game_id, alert]));

  if (!signedIn) return <AppShell><SectionHeader title="Wishlist" hint="Sign in to save catalog games and price alerts." /><div className="rounded-2xl border border-border bg-surface p-6 text-sm text-muted-foreground"><Link to="/login" className="font-bold text-primary">Sign in</Link> to manage your wishlist.</div></AppShell>;

  return <AppShell>
    <SectionHeader title="Wishlist" hint={wishlistQuery.isLoading ? "Loading your saved games…" : `${wishlistQuery.data?.length ?? 0} saved games`} />
    <section className="mb-8"><div className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3"><Search className="size-4 text-muted-foreground" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find a catalog game to save" className="flex-1 bg-transparent text-sm outline-none" /></div>{catalogQuery.data && <div className="mt-2 space-y-2">{catalogQuery.data.results.filter((game) => game.id && game.name).slice(0, 5).map((game) => <div key={game.id} className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3"><GameCover from={game.background_image ?? "#0f172a"} to="#0f172a" title={game.name!} compact className="size-10 rounded" /><p className="min-w-0 flex-1 truncate text-sm font-bold">{game.name}</p><button onClick={() => addWish.mutate({ id: game.id!, title: game.name!, cover: game.background_image })} className="rounded-md bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground">Add wishlist</button><button onClick={() => addFav.mutate({ id: game.id!, title: game.name!, cover: game.background_image })} className="rounded-md border border-border p-2" aria-label={`Favorite ${game.name}`}><Heart className="size-3.5" /></button></div>)}</div>}</section>
    {alertItem && <section className="mb-6 rounded-2xl border border-primary/30 bg-surface p-5"><SectionHeader title={`Alert for ${alertItem.title}`} hint="Set a target price or a minimum discount. In-app delivery is always enabled." /><form onSubmit={submitAlert} className="flex flex-wrap gap-3"><input value={targetPrice} onChange={(event) => setTargetPrice(event.target.value)} inputMode="decimal" placeholder="Target price" className="w-40 rounded-lg border border-border bg-secondary px-3 py-2 text-sm outline-none" /><input value={targetDiscount} onChange={(event) => setTargetDiscount(event.target.value)} inputMode="numeric" placeholder="Discount %" className="w-32 rounded-lg border border-border bg-secondary px-3 py-2 text-sm outline-none" /><button disabled={(!targetPrice && !targetDiscount) || addAlert.isPending} className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">Save alert</button><button type="button" onClick={() => setAlertItem(null)} className="rounded-lg border border-border px-4 py-2 text-sm font-bold">Cancel</button></form></section>}
    <section className="space-y-4">{wishlistQuery.isError && <p className="rounded-2xl border border-border bg-surface p-5 text-sm text-muted-foreground">Your wishlist could not be loaded right now.</p>}{wishlistQuery.isSuccess && wishlistQuery.data.length === 0 && <p className="rounded-2xl border border-border bg-surface p-5 text-sm text-muted-foreground">Search the catalog above to save your first game.</p>}{wishlistQuery.data?.map((item) => <WishlistCard key={item.catalog_game_id} item={item} alert={alertByGame.get(item.catalog_game_id)} onRemove={() => removeWish.mutate(item.catalog_game_id)} onAlert={() => setAlertItem(item)} />)}</section>
    <section className="mt-10"><SectionHeader title="Favorites" hint={`${favoritesQuery.data?.length ?? 0} favorites`} /><div className="grid grid-cols-2 gap-4 md:grid-cols-4">{favoritesQuery.data?.map((item) => <article key={item.catalog_game_id} className="overflow-hidden rounded-xl border border-border bg-surface"><GameCover from={item.cover_url ?? "#0f172a"} to="#0f172a" title={item.title} className="aspect-[3/4] w-full" /><div className="flex items-center gap-2 p-3"><Link to="/games/$gameId" params={{ gameId: String(item.catalog_game_id) }} className="min-w-0 flex-1 truncate text-sm font-bold">{item.title}</Link><button onClick={() => removeFav.mutate(item.catalog_game_id)} aria-label={`Remove favorite ${item.title}`} className="text-muted-foreground"><X className="size-3.5" /></button></div></article>)}{favoritesQuery.isSuccess && favoritesQuery.data.length === 0 && <p className="col-span-full rounded-xl border border-border bg-surface p-4 text-sm text-muted-foreground">Use the heart next to a catalog search result to save favorites.</p>}</div></section>
  </AppShell>;
}
