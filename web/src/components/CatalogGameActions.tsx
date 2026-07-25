import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CatalogGame } from "@/lib/api";
import {
  ApiError,
  isAuthenticated,
  listFavorites,
  listSavedGames,
  listWishlist,
  saveCatalogGameToFavorites,
  saveCatalogGameToLibrary,
  saveCatalogGameToWishlist,
} from "@/lib/api";
import { lovableQueryKeys } from "@/lib/lovable-data";

type CatalogActionGame = Pick<CatalogGame, "id" | "name">;

function mutationMessage(error: unknown) {
  return error instanceof ApiError ? error.message : "Could not save this game. Please try again.";
}

export function CatalogGameActions({ game }: { game: CatalogActionGame }) {
  const queryClient = useQueryClient();
  const authenticated = isAuthenticated();
  const savedGames = useQuery({
    queryKey: lovableQueryKeys.savedGames,
    queryFn: listSavedGames,
    enabled: authenticated,
  });
  const wishlist = useQuery({
    queryKey: lovableQueryKeys.wishlist,
    queryFn: listWishlist,
    enabled: authenticated,
  });
  const favorites = useQuery({
    queryKey: lovableQueryKeys.favorites,
    queryFn: listFavorites,
    enabled: authenticated,
  });
  const invalidateCollections = () => {
    queryClient.invalidateQueries({ queryKey: lovableQueryKeys.savedGames });
    queryClient.invalidateQueries({ queryKey: lovableQueryKeys.favorites });
    queryClient.invalidateQueries({ queryKey: lovableQueryKeys.wishlist });
    queryClient.invalidateQueries({ queryKey: lovableQueryKeys.dashboard });
    queryClient.invalidateQueries({ queryKey: lovableQueryKeys.profileSummary });
  };
  const libraryMutation = useMutation({
    mutationFn: () => saveCatalogGameToLibrary(game.id),
    onSuccess: invalidateCollections,
  });
  const wishlistMutation = useMutation({
    mutationFn: () => saveCatalogGameToWishlist(game.id),
    onSuccess: invalidateCollections,
  });
  const favoriteMutation = useMutation({
    mutationFn: () => saveCatalogGameToFavorites(game.id),
    onSuccess: invalidateCollections,
  });

  if (!authenticated) return null;

  const inLibrary = savedGames.data?.some(
    (saved) => saved.source === "catalog" && saved.external_id === `rawg:${game.id}`,
  ) || libraryMutation.isSuccess;
  const inWishlist = wishlist.data?.some(
    (item) => item.catalog_game_id === game.id,
  ) || wishlistMutation.isSuccess;
  const inFavorites = favorites.data?.some(
    (item) => item.catalog_game_id === game.id,
  ) || favoriteMutation.isSuccess;

  return (
    <div className="flex flex-wrap gap-2" aria-label={`Save ${game.name}`}>
      <button
        type="button"
        onClick={() => libraryMutation.mutate()}
        disabled={inLibrary || libraryMutation.isPending}
        className="rounded-lg bg-primary px-3 py-2 text-sm font-bold text-primary-foreground disabled:cursor-default disabled:opacity-70"
      >
        {inLibrary ? "In library" : libraryMutation.isPending ? "Adding…" : "Add to library"}
      </button>
      <button
        type="button"
        onClick={() => wishlistMutation.mutate()}
        disabled={inWishlist || wishlistMutation.isPending}
        className="rounded-lg border border-border px-3 py-2 text-sm font-bold hover:bg-secondary disabled:cursor-default disabled:opacity-70"
      >
        {inWishlist ? "In wishlist" : wishlistMutation.isPending ? "Adding…" : "Add to wishlist"}
      </button>
      <button
        type="button"
        onClick={() => favoriteMutation.mutate()}
        disabled={inFavorites || favoriteMutation.isPending}
        className="rounded-lg border border-border px-3 py-2 text-sm font-bold hover:bg-secondary disabled:cursor-default disabled:opacity-70"
      >
        {inFavorites ? "In favorites" : favoriteMutation.isPending ? "Adding…" : "Add to favorites"}
      </button>
      {(libraryMutation.error || wishlistMutation.error || favoriteMutation.error) && (
        <p className="w-full text-xs text-destructive" role="alert">
          {mutationMessage(libraryMutation.error || wishlistMutation.error || favoriteMutation.error)}
        </p>
      )}
    </div>
  );
}
