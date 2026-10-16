import { useEffect, useState } from "react";
import { ArrowRight, Check, Gamepad2, Search, ChevronDown, LoaderCircle } from "lucide-react";
import { GameCover } from "@/components/GameCover";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  applyLibraryCatalogMatches,
  searchGames,
  type LibraryCatalogMatch,
  type LibraryCatalogSuggestion,
  type LibraryCatalogDecision,
} from "@/lib/api";
import { useLibraryCatalogJob } from "@/hooks/useLibraryCatalogJob";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";

const button =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-semibold transition-colors hover:bg-foreground/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50";

type MatchScope = { source?: "psn" | "manual" };

function CandidateChoice({
  candidate,
  chosen,
  disabled,
  onChoose,
}: {
  candidate: LibraryCatalogSuggestion;
  chosen: boolean;
  disabled: boolean;
  onChoose: () => void;
}) {
  const metadata = [candidate.released?.slice(0, 4), ...candidate.platforms]
    .filter(Boolean)
    .join(", ");
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={chosen}
      aria-label={`Choose ${candidate.title}${metadata ? `, ${metadata}` : ""}`}
      onClick={onChoose}
      className={`flex min-w-0 items-center gap-3 rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${chosen ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
    >
      <GameCover
        from="#171717"
        to="#303030"
        title={candidate.title}
        image={candidate.cover_url ?? undefined}
        compact
        fit="contain"
        className="h-16 w-11 shrink-0 rounded-md"
      />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold">{candidate.title}</span>
        <span className="mt-1 block text-xs text-muted-foreground">
          {candidate.released?.slice(0, 4) ?? "Year unavailable"}
        </span>
        <span className="mt-1 block text-xs text-muted-foreground">
          {candidate.platforms.join(", ") || "Platforms unavailable"}
        </span>
      </span>
      {chosen && <Check className="size-4 shrink-0 text-primary" aria-hidden="true" />}
    </button>
  );
}

function CatalogMatchRow({
  item,
  proposal,
  decision,
  disabled,
  onProposal,
  onDecision,
}: {
  item: LibraryCatalogMatch;
  proposal?: LibraryCatalogSuggestion;
  decision?: LibraryCatalogDecision;
  disabled: boolean;
  onProposal: (proposal: LibraryCatalogSuggestion) => void;
  onDecision: (decision?: LibraryCatalogDecision) => void;
}) {
  const [query, setQuery] = useState(item.title);
  const search = useMutation({ mutationFn: () => searchGames({ query: query.trim() }) });
  const expected = item.catalog_game_id ?? null;
  return (
    <article
      className={`space-y-4 rounded-xl border bg-background p-4 sm:p-5 ${decision ? "border-primary/60" : "border-border"}`}
    >
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1.2fr)] md:items-center">
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            aria-label={`Select ${item.title}`}
            checked={!!decision}
            disabled={disabled || (!proposal && !decision)}
            className="mt-1 size-4 shrink-0 accent-[var(--primary)]"
            onChange={(event) =>
              onDecision(
                event.target.checked && proposal
                  ? {
                      game_id: item.game_id,
                      action: "link",
                      catalog_id: proposal.id,
                      expected_catalog_game_id: expected,
                    }
                  : undefined,
              )
            }
          />
          <div className="min-w-0">
            <p className="mb-1 text-xs text-muted-foreground">
              {item.source === "psn" ? "PlayStation file import" : "Manual entry"}
            </p>
            <h3 className="font-bold leading-snug">{item.title}</h3>
            {decision?.action === "unlink" && (
              <p className="mt-2 text-xs text-muted-foreground">
                Link will be removed; library entry will remain.
              </p>
            )}
            {decision?.action === "keep_raw" && (
              <p className="mt-2 text-xs text-muted-foreground">This entry will stay unlinked.</p>
            )}
          </div>
        </div>
        <ArrowRight className="hidden size-4 text-muted-foreground md:block" aria-hidden="true" />
        <div className="flex min-w-0 items-center gap-3 rounded-lg bg-surface p-3">
          {proposal ? (
            <GameCover
              from="#171717"
              to="#303030"
              title={proposal.title}
              image={proposal.cover_url ?? undefined}
              compact
              fit="contain"
              className="h-[84px] w-14 shrink-0 rounded-md"
            />
          ) : (
            <Gamepad2 className="m-3 size-7 shrink-0 text-muted-foreground" aria-hidden="true" />
          )}
          <div className="min-w-0">
            {proposal ? (
              <>
                <p className="text-sm font-bold leading-snug">{proposal.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {proposal.released?.slice(0, 4) ?? "Year unavailable"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {proposal.platforms?.join(", ") || "Platforms unavailable"}
                </p>
                <span
                  className={`mt-2 inline-block rounded-md px-2 py-1 text-xs font-semibold ${proposal.confidence !== "exact" || item.status !== "matched" ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" : "bg-primary/10 text-primary"}`}
                >
                  {proposal.confidence !== "exact" || item.status !== "matched"
                    ? "Uncertain match"
                    : "Title matched"}
                </span>
              </>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                {item.status === "unavailable"
                  ? "Catalog temporarily unavailable. Retry this lookup."
                  : expected
                    ? "Already linked. Search below to correct it."
                    : "No catalog match found."}
              </p>
            )}
          </div>
        </div>
      </div>
      {item.suggestions.length > 1 && (
        <div className="grid gap-2 sm:grid-cols-2">
          {item.suggestions.map((candidate) => (
            <CandidateChoice
              key={candidate.id}
              candidate={candidate}
              chosen={proposal?.id === candidate.id}
              disabled={disabled}
              onChoose={() => onProposal(candidate)}
            />
          ))}
        </div>
      )}
      <details className="border-t border-border pt-3">
        <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground">
          <Search className="size-3.5" aria-hidden="true" /> Choose another catalog game{" "}
          <ChevronDown className="ml-auto size-3.5" aria-hidden="true" />
        </summary>
        <form
          className="mt-2 flex flex-wrap gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (query.trim()) search.mutate();
          }}
        >
          <input
            className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm"
            aria-label={`Search catalog for ${item.title}`}
            value={query}
            disabled={disabled}
            onChange={(event) => {
              setQuery(event.target.value);
              search.reset();
            }}
          />
          <button
            className={button}
            disabled={disabled || search.isPending || !query.trim()}
            aria-label={`Search for ${item.title}`}
          >
            Search catalog
          </button>
        </form>
        {search.isPending && <p className="text-sm">Searching catalog…</p>}
        {search.isError && (
          <p role="alert" className="text-sm">
            Catalog search failed. Try again.
          </p>
        )}
        {search.data?.results.length === 0 && (
          <p className="text-sm">No games found. Try a different title.</p>
        )}
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {search.data?.results
            .filter((game) => Number.isInteger(game.id))
            .map((game) => (
              <CandidateChoice
                key={game.id}
                candidate={{
                  id: game.id!,
                  title: game.name,
                  platforms: game.platforms ?? [],
                  released: game.released,
                  confidence: "likely",
                  cover_url: game.background_image,
                }}
                chosen={proposal?.id === game.id}
                disabled={disabled}
                onChoose={() =>
                  onProposal({
                    id: game.id!,
                    title: game.name,
                    platforms: game.platforms ?? [],
                    released: game.released,
                    confidence: "likely",
                    cover_url: game.background_image,
                  })
                }
              />
            ))}
        </div>
      </details>
      <button
        className="text-xs font-semibold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        disabled={disabled}
        onClick={() =>
          onDecision({
            game_id: item.game_id,
            action: expected ? "unlink" : "keep_raw",
            expected_catalog_game_id: expected,
          })
        }
      >
        {expected ? `Remove link for ${item.title}` : `Leave ${item.title} unlinked`}
      </button>
    </article>
  );
}

export function LibraryCatalogMatches({ source }: MatchScope = {}) {
  const client = useQueryClient();
  const [includeLinked, setIncludeLinked] = useState(false);
  const [proposals, setProposals] = useState<Record<string, LibraryCatalogSuggestion>>({});
  const [decisions, setDecisions] = useState<Record<string, LibraryCatalogDecision>>({});
  const [confirmation, setConfirmation] = useState<LibraryCatalogDecision[] | null>(null);
  const [message, setMessage] = useState("");
  const task = useLibraryCatalogJob(source);
  const result = task.job?.result;
  const previewData = task.job?.status === "succeeded" && !result?.dismissed ? result : undefined;
  const savedCorrectionOption = result?.include_linked;
  useEffect(() => {
    if (savedCorrectionOption !== undefined) setIncludeLinked(savedCorrectionOption);
  }, [savedCorrectionOption]);
  useEffect(() => {
    setDecisions({});
    setProposals(
      Object.fromEntries(
        (previewData?.items ?? [])
          .filter((row) => row.suggestions.length)
          .map((row) => [row.game_id, row.suggestions[0]]),
      ),
    );
  }, [previewData]);
  const apply = useMutation({
    mutationFn: (choices: LibraryCatalogDecision[]) => applyLibraryCatalogMatches(choices),
    onMutate: () => task.job?.id,
    onSuccess: ({ updated }) => {
      setMessage(`Updated ${updated} library entries. Your source records are preserved.`);
      setDecisions({});
      setProposals({});
    },
    onError: () => {
      setDecisions({});
      setProposals({});
    },
    onSettled: async (_data, _error, _choices, previewJobId) => {
      try {
        if (previewJobId) await task.dismiss(previewJobId);
      } catch {
        setMessage("Could not clear the saved preview. Find fresh matches before applying again.");
      }
      await Promise.all(
        [
          "library",
          "library-overview",
          "library-overview-page",
          "library-membership",
          "game-membership",
          "dashboard",
          "wishlist",
          "wishlist-page",
          "price-alerts",
          "psn-library-repair",
        ].map((key) => client.invalidateQueries({ queryKey: [key] })),
      );
    },
  });
  const selected = Object.values(decisions);
  const uncertainCount = selected.filter(
    (row) =>
      row.action === "link" &&
      (proposals[row.game_id]?.confidence !== "exact" ||
        previewData?.items.find((item) => item.game_id === row.game_id)?.status !== "matched"),
  ).length;
  const busy = task.running || apply.isPending;
  const progressPercent = Math.min(
    100,
    Math.round(((result?.processed ?? 0) / Math.max(result?.total ?? 1, 1)) * 100),
  );
  function updateDecision(id: string, decision?: LibraryCatalogDecision) {
    setDecisions((previous) => {
      const next = { ...previous };
      if (decision) next[id] = decision;
      else delete next[id];
      return next;
    });
  }
  return (
    <section
      className="space-y-6 rounded-2xl border border-border bg-surface p-4 sm:p-6"
      aria-label="Match library to catalog"
    >
      <div className="flex items-start gap-3 sm:gap-4">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Search className="size-5" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-bold leading-tight sm:text-xl">
            {source === "psn"
              ? "Complete your PlayStation library"
              : "Match your library to the catalog"}
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
            Find covers and game details for your imported titles. You confirm every link.
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-4 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <label className="inline-flex items-center gap-2.5 text-sm font-medium">
            <input
              type="checkbox"
              checked={includeLinked}
              disabled={busy}
              className="size-4 shrink-0 accent-[var(--primary)]"
              aria-describedby="catalog-correction-help"
              onChange={(event) => setIncludeLinked(event.target.checked)}
            />
            Recheck already matched games
          </label>
          <p
            id="catalog-correction-help"
            className="mt-1.5 pl-[26px] text-xs leading-relaxed text-muted-foreground"
          >
            Include linked titles to review or correct their matches.
          </p>
        </div>
        <button
          className={
            button +
            " min-h-10 shrink-0 border-primary bg-primary px-4 text-primary-foreground hover:bg-primary/90"
          }
          disabled={busy}
          onClick={() => {
            apply.reset();
            setMessage("");
            task.start.mutate(includeLinked);
          }}
        >
          {task.running ? "Finding catalog matches…" : "Find catalog matches"}
        </button>
      </div>
      {task.running && (
        <div
          className="rounded-xl border border-primary/20 bg-background p-4 sm:p-5"
          aria-busy="true"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center gap-3">
            <LoaderCircle
              className="size-5 shrink-0 animate-spin text-primary motion-reduce:animate-none"
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Finding your games</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Checked {result?.processed ?? 0} of {result?.total ?? 0} games
              </p>
            </div>
            <span className="text-xl font-semibold tabular-nums tracking-tight" aria-hidden="true">
              {progressPercent}%
            </span>
          </div>
          <progress
            aria-label="Catalog matching progress"
            value={result?.processed ?? 0}
            max={Math.max(result?.total ?? 1, 1)}
            className="mt-4 block h-1.5 w-full overflow-hidden rounded-full bg-surface accent-primary [&::-moz-progress-bar]:rounded-full [&::-moz-progress-bar]:bg-primary [&::-webkit-progress-bar]:rounded-full [&::-webkit-progress-bar]:bg-surface [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-primary [&::-webkit-progress-value]:transition-[width] motion-reduce:[&::-webkit-progress-value]:transition-none"
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 font-medium">
              <Check className="size-3.5 text-primary" aria-hidden="true" />
              Matches for {result?.matched ?? 0} {result?.matched === 1 ? "game" : "games"}
            </span>
            <span className="tabular-nums text-muted-foreground">
              {result?.remaining ?? 0} remaining
            </span>
          </div>
          <p className="mt-4 border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground">
            Feel free to leave this page. Matching continues in the background, and your results
            will be saved here.
          </p>
        </div>
      )}
      {(task.start.isError ||
        task.current.isError ||
        task.job?.status === "failed" ||
        apply.isError) && (
        <p role="alert" className="text-sm text-red-600">
          {(task.start.error ?? task.current.error ?? apply.error)?.message ??
            task.job?.error ??
            "Could not update catalog links. Try again."}
        </p>
      )}
      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
      {previewData && (
        <>
          <p className="flex items-start gap-2 text-sm leading-relaxed text-muted-foreground">
            <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            <span>
              {previewData.processed} games checked. Matches for {previewData.matched}{" "}
              {previewData.matched === 1 ? "game" : "games"}. Nothing changes until you apply your
              choices. If a game is not found, search the catalog manually.
            </span>
          </p>
          <div className="sticky top-3 z-20 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface/95 p-3 shadow-sm backdrop-blur">
            <button
              className={button}
              disabled={busy}
              onClick={() =>
                setDecisions(
                  Object.fromEntries(
                    previewData.items
                      .filter((item) => proposals[item.game_id])
                      .map((item) => [
                        item.game_id,
                        {
                          game_id: item.game_id,
                          action: "link" as const,
                          catalog_id: proposals[item.game_id].id,
                          expected_catalog_game_id: item.catalog_game_id ?? null,
                        },
                      ]),
                  ),
                )
              }
            >
              Select all matches (including uncertain)
            </button>
            <button
              className={button}
              disabled={busy || !selected.length}
              onClick={() => setDecisions({})}
            >
              Clear selection
            </button>
            <button
              className={button + " bg-primary text-primary-foreground"}
              disabled={busy || !selected.length}
              onClick={() => {
                if (uncertainCount) setConfirmation(selected);
                else apply.mutate(selected);
              }}
            >
              Apply selected ({selected.length})
            </button>
          </div>
          <div className="space-y-3">
            {previewData.items.map((item) => (
              <CatalogMatchRow
                key={item.game_id}
                item={item}
                proposal={proposals[item.game_id]}
                decision={decisions[item.game_id]}
                disabled={busy}
                onDecision={(decision) => updateDecision(item.game_id, decision)}
                onProposal={(proposal) => {
                  setProposals((previous) => ({ ...previous, [item.game_id]: proposal }));
                  if (decisions[item.game_id])
                    updateDecision(item.game_id, {
                      game_id: item.game_id,
                      action: "link",
                      catalog_id: proposal.id,
                      expected_catalog_game_id: item.catalog_game_id ?? null,
                    });
                }}
              />
            ))}
          </div>
        </>
      )}
      <AlertDialog
        open={confirmation !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmation(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm uncertain catalog matches</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmation?.length} selected matches include {uncertainCount} uncertain{" "}
              {uncertainCount === 1 ? "match" : "matches"}. Some entries may link to a different
              game. Confirmed links affect library ownership and may pause price alerts. You can
              correct links later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmation) apply.mutate(confirmation);
                setConfirmation(null);
              }}
            >
              Confirm selected matches
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

export function LibraryCatalogMatchLauncher({ source }: MatchScope = {}) {
  const [open, setOpen] = useState(false);
  const { job, running } = useLibraryCatalogJob(source);
  const restoredJobId = job && !job.result?.dismissed ? job.id : undefined;
  useEffect(() => {
    if (restoredJobId) setOpen(true);
  }, [restoredJobId]);
  return (
    <div>
      <button className={button} onClick={() => setOpen(!open)} aria-expanded={open}>
        {running && !open && (
          <LoaderCircle
            className="size-4 animate-spin motion-reduce:animate-none"
            aria-hidden="true"
          />
        )}
        {open
          ? "Close catalog matching"
          : source === "psn"
            ? "Match PlayStation games"
            : "Match library to catalog"}
        <ChevronDown
          className={`size-4 text-muted-foreground transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>
      {open && (
        <div className="mt-3">
          <LibraryCatalogMatches source={source} />
        </div>
      )}
    </div>
  );
}
