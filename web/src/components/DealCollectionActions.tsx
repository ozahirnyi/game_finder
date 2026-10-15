import { useSyncExternalStore } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ApiError,
  addSteamWishlist,
  getAuthSnapshot,
  getLibraryOverview,
  getWishlist,
  saveCatalogGameToWishlist,
  subscribeToAuthChanges,
  type Deal,
  type CollectionGame,
} from "@/lib/api";

/** Public offer data stays separate from these shared, authenticated collection reads. */
export function DealCollectionActions({ deal }: { deal: Deal }) {
  const signedIn = useSyncExternalStore(subscribeToAuthChanges, getAuthSnapshot, () => false);
  const client = useQueryClient();
  const library = useQuery({
    queryKey: ["library"],
    queryFn: () => getLibraryOverview(),
    enabled: signedIn,
    staleTime: 60_000,
  });
  const wishlist = useQuery({
    queryKey: ["wishlist"],
    queryFn: () => getWishlist(),
    enabled: signedIn,
    staleTime: 60_000,
  });
  const save = useMutation({
    mutationFn: () =>
      deal.steam_appid ? addSteamWishlist(deal.steam_appid) : saveCatalogGameToWishlist(deal.id!),
    onSuccess: (item) => {
      client.setQueryData<CollectionGame[]>(["wishlist"], (previous) => [
        ...(previous ?? []).filter((row) => row.id !== item.id),
        item,
      ]);
      void client.invalidateQueries({ queryKey: ["wishlist"] });
      void client.invalidateQueries({ queryKey: ["wishlist-page"] });
      void client.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: () => {
      void client.invalidateQueries({ queryKey: ["library"] });
      void client.invalidateQueries({ queryKey: ["wishlist"] });
    },
  });
  if (!signedIn) return null;
  const owned =
    library.data?.games.filter((game) =>
      game.source === "steam"
        ? !!deal.steam_appid && game.external_id === String(deal.steam_appid)
        : !!deal.id &&
          game.catalog_game_id === deal.id &&
          (game.source !== "psn" || game.link_state === "linked") &&
          game.link_state !== "raw",
    ) ?? [];
  const wishlisted = wishlist.data?.some((item) =>
    item.source === "steam"
      ? !!deal.steam_appid && item.external_id === String(deal.steam_appid)
      : item.source === "catalog" && !!deal.id && item.catalog_game_id === deal.id,
  );
  const sources = [
    ...new Set(
      owned.map((game) =>
        game.source === "psn" ? "PlayStation" : game.source === "steam" ? "Steam" : "Manual",
      ),
    ),
  ];
  const style =
    "relative z-20 mt-3 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-semibold disabled:opacity-50";
  if (sources.length)
    return (
      <p className="relative z-20 mt-3 text-xs font-semibold text-primary">
        In your library · {sources.join(", ")}
      </p>
    );
  if (wishlisted || save.isSuccess)
    return (
      <p className="relative z-20 mt-3 text-xs font-semibold text-primary">In your wishlist</p>
    );
  if (library.isError || wishlist.isError || library.data?.steam_error)
    return (
      <button
        className={style}
        onClick={() => {
          void library.refetch();
          void wishlist.refetch();
        }}
      >
        Retry library status
      </button>
    );
  if (library.isPending || wishlist.isPending)
    return <p className="mt-3 text-xs text-muted-foreground">Checking your library…</p>;
  if (!deal.steam_appid && !deal.id) return null;
  return (
    <div className="relative z-20">
      <button
        className={style}
        disabled={save.isPending}
        aria-label={`Add ${deal.name} to wishlist`}
        onClick={() => save.mutate()}
      >
        {save.isPending ? "Saving…" : "+ Wishlist"}
      </button>
      {save.isError && (
        <p role="alert" className="mt-2 text-xs text-red-600">
          {save.error instanceof ApiError && save.error.status === 409
            ? "Your collection changed. Refreshing library status; try again if this game is still missing."
            : "Could not save this game. Try again."}
        </p>
      )}
    </div>
  );
}
