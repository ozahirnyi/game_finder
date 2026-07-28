import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Heart, Star } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { GameCover } from "@/components/GameCover";
import { Chip, Panel, SectionHeader } from "@/components/ui-bits";
import { addWishlist, getCatalogGame, getPriceHistory } from "@/lib/api";

export const Route = createFileRoute("/games/$gameId")({ component: GameDetail });

function GameDetail() {
  const { gameId } = Route.useParams();
  const gameQuery = useQuery({
    queryKey: ["catalog-game", gameId],
    queryFn: () => getCatalogGame(gameId),
  });
  const pricesQuery = useQuery({
    queryKey: ["prices", gameId],
    queryFn: () => getPriceHistory(gameId),
  });
  const wishlistMutation = useMutation({ mutationFn: addWishlist });
  const game = gameQuery.data;
  const price = pricesQuery.data?.current;

  return (
    <AppShell>
      <Link
        to="/search"
        className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to search
      </Link>
      {gameQuery.isLoading && <p className="text-sm text-muted-foreground">Loading game…</p>}
      {gameQuery.isError && <p className="text-sm text-destructive">Unable to load this game.</p>}
      {game && (
        <>
          <section className="mb-8 overflow-hidden rounded-3xl border border-border">
            <GameCover
              from="#c75f28"
              to="#22243a"
              title={game.name}
              className="h-72 w-full sm:h-96"
            />
            <div className="p-6 sm:p-8">
              <div className="mb-3 flex flex-wrap gap-2">
                {(game.genres ?? []).map((genre) => (
                  <Chip key={genre}>{genre}</Chip>
                ))}
              </div>
              <h1 className="text-4xl font-extrabold">{game.name}</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {(game.platforms ?? []).join(" · ") || game.released || "Catalogue game"}
              </p>
            </div>
          </section>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <Panel className="p-6">
              <SectionHeader title="About" />
              <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                {game.description_raw ?? "Description is not available yet."}
              </p>
            </Panel>
            <Panel className="p-6">
              <SectionHeader title="Live price" />
              <p className="text-3xl font-black text-primary">
                {price?.price ? `${price.price.amount} ${price.price.currency}` : "Unavailable"}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {price?.shop ?? "No store quote available"}
              </p>
              <button
                onClick={() => wishlistMutation.mutate(game)}
                disabled={wishlistMutation.isPending}
                className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
              >
                <Heart className="size-4" />{" "}
                {wishlistMutation.isPending ? "Saving…" : "Add to wishlist"}
              </button>
              {game.rating && (
                <p className="mt-4 flex items-center gap-1 text-sm">
                  <Star className="size-4 text-primary" /> {game.rating} rating
                </p>
              )}
            </Panel>
          </div>
        </>
      )}
    </AppShell>
  );
}
