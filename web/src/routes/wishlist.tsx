import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { GameCover } from "@/components/GameCover";
import { PriceAlertForm } from "@/components/PriceAlertForm";
import { EmptyState, SectionHeader } from "@/components/ui-bits";
import {
  createPriceAlert,
  deletePriceAlert,
  getPriceAlerts,
  getWishlist,
  removeWishlist,
  type PriceAlertCreate,
} from "@/lib/api";
import { wishlistPriceLabel } from "@/lib/collectionPresentation";
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
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [showAlerts, setShowAlerts] = useState(false);
  const [catalogGameId, setCatalogGameId] = useState("");
  const wishlistQuery = useQuery({ queryKey: ["wishlist"], queryFn: getWishlist });
  const removeMutation = useMutation({
    mutationFn: removeWishlist,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["wishlist"] }),
  });
  const alertsQuery = useQuery({ queryKey: ["price-alerts"], queryFn: getPriceAlerts });
  const alertMutation = useMutation({
    mutationFn: (data: PriceAlertCreate) => createPriceAlert(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["price-alerts"] });
      setShowAlerts(false);
    },
  });
  const deleteAlertMutation = useMutation({
    mutationFn: deletePriceAlert,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["price-alerts"] }),
  });

  const wl = wishlistQuery.data ?? [];

  return (
    <AppShell>
      <SectionHeader
        title="Wishlist"
        hint="Games you're waiting on, with live pricing"
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setCatalogGameId(String(wl[0]?.catalog_game_id ?? ""));
                setShowAlerts(true);
              }}
              disabled={wl.length === 0}
              className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-bold hover:bg-foreground/5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Bell className="size-3.5" /> Price alerts
            </button>
          </div>
        }
      />

      {showAlerts && (
        <section
          aria-label="Price alerts"
          className="mb-6 rounded-2xl border border-border bg-surface p-5"
        >
          <h2 className="text-lg font-bold">Price alerts</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {alertsQuery.data?.length ?? 0} active alert
            {(alertsQuery.data?.length ?? 0) === 1 ? "" : "s"}.
          </p>
          {!!alertsQuery.data?.length && (
            <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
              {alertsQuery.data.map((alert) => {
                const title = wl.find((game) => game.catalog_game_id === alert.wishlist_catalog_game_id)?.title
                  ?? `Game #${alert.wishlist_catalog_game_id}`;
                return (
                  <li key={alert.id} className="flex items-center gap-2">
                    <span>
                      {title}: {alert.target_price != null
                        ? `alert below ${alert.target_price}`
                        : alert.target_discount === 1
                          ? "any discount"
                          : `alert at ${alert.target_discount}% off`}
                    </span>
                    <button
                      type="button"
                      aria-label={`Cancel alert for ${title}`}
                      onClick={() => deleteAlertMutation.mutate(alert.id)}
                      disabled={deleteAlertMutation.isPending}
                      className="font-semibold text-destructive hover:underline disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="mt-4 space-y-3">
            <label className="grid gap-1 text-sm font-semibold">
              Game
              <select
                value={catalogGameId}
                onChange={(event) => setCatalogGameId(event.target.value)}
                className="rounded-lg border border-border bg-background px-3 py-2"
              >
                {wl.map((game) => (
                  <option key={game.id} value={game.catalog_game_id}>
                    {game.title}
                  </option>
                ))}
              </select>
            </label>
            {catalogGameId && (
              <PriceAlertForm
                wishlistCatalogGameId={Number(catalogGameId)}
                onSubmit={(data) => alertMutation.mutate(data)}
                onCancel={() => setShowAlerts(false)}
                isPending={alertMutation.isPending}
                errorMessage={
                  alertMutation.error instanceof Error ? alertMutation.error.message : undefined
                }
              />
            )}
          </div>
        </section>
      )}

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
              data-testid={`wishlist-card-${g.id}`}
              role="link"
              tabIndex={0}
              onClick={() =>
                navigate({
                  to: "/games/$gameId",
                  params: { gameId: String(g.catalog_game_id) },
                  search: g.source === "steam" ? { source: "steam", title: g.title } : {},
                })
              }
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  navigate({
                    to: "/games/$gameId",
                    params: { gameId: String(g.catalog_game_id) },
                    search: g.source === "steam" ? { source: "steam", title: g.title } : {},
                  });
                }
              }}
              className="hover-lift grid cursor-pointer grid-cols-1 gap-6 rounded-2xl border border-border bg-surface p-5 hover:border-primary/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary md:grid-cols-[auto_minmax(0,1fr)_auto_auto] md:items-center"
            >
              <Link
                to="/games/$gameId"
                params={{ gameId: String(g.catalog_game_id) }}
                search={g.source === "steam" ? { source: "steam", title: g.title } : {}}
              >
                <GameCover
                  from="#7c3aed"
                  to="#111827"
                  title={g.title}
                  image={g.cover_url ?? undefined}
                  compact
                  bare
                  className="size-20 rounded-lg"
                />
              </Link>
              <div className="min-w-0">
                <Link
                  to="/games/$gameId"
                  params={{ gameId: String(g.catalog_game_id) }}
                  search={g.source === "steam" ? { source: "steam", title: g.title } : {}}
                  className="truncate text-lg font-bold transition-colors hover:text-primary"
                >
                  {g.title}
                </Link>
                <p className="mt-1 text-xs text-muted-foreground">Saved game</p>
              </div>
              <p className="text-right text-xs font-bold text-muted-foreground">
                {wishlistPriceLabel()}
              </p>
              <div className="flex items-center justify-end gap-2">
                <Link
                  to="/games/$gameId"
                  params={{ gameId: String(g.catalog_game_id) }}
                  search={g.source === "steam" ? { source: "steam", title: g.title } : {}}
                  className="rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground"
                >
                  View game
                </Link>
                <button
                  aria-label={`Remove ${g.title} from wishlist`}
                  onClick={(event) => {
                    event.stopPropagation();
                    removeMutation.mutate(g.id);
                  }}
                  disabled={removeMutation.isPending}
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
