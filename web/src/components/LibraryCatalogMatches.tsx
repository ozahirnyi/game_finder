import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  applyLibraryCatalogMatches,
  previewLibraryCatalogMatches,
  searchGames,
  type LibraryCatalogMatch,
  type LibraryCatalogSuggestion,
  type LibraryCatalogDecision,
} from "@/lib/api";
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
  "rounded-lg border border-border px-3 py-2 text-sm font-semibold disabled:opacity-50";

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
    <article className="space-y-3 rounded-xl border border-border bg-background p-4">
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          aria-label={`Select ${item.title}`}
          checked={!!decision}
          disabled={disabled || (!proposal && !decision)}
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
          <h3 className="font-bold">{item.title}</h3>
          <p className="text-xs text-muted-foreground">
            {item.source === "psn" ? "PlayStation file import" : "Manual entry"}
          </p>
          {proposal ? (
            <p className="mt-2 text-sm">
              Suggested: <strong>{proposal.title}</strong>
              {proposal.released && ` · ${proposal.released}`}
              {proposal.platforms?.length > 0 && ` · ${proposal.platforms.join(", ")}`}
              {(proposal.confidence !== "exact" || item.status !== "matched") && (
                <span className="ml-2 text-amber-600">Uncertain match</span>
              )}
            </p>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              {item.status === "unavailable"
                ? "Catalog temporarily unavailable. Retry this lookup."
                : expected
                  ? "Already linked. Search below to correct it."
                  : "No catalog match found."}
            </p>
          )}
          {item.reason && <p className="text-xs text-muted-foreground">{item.reason}</p>}
          {decision?.action === "unlink" && (
            <p className="text-sm">Link will be removed; library entry will remain.</p>
          )}
          {decision?.action === "keep_raw" && (
            <p className="text-sm">This entry will stay unlinked.</p>
          )}
        </div>
      </div>
      {item.suggestions.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {item.suggestions.map((candidate) => (
            <button
              key={candidate.id}
              className={button}
              disabled={disabled}
              onClick={() => onProposal(candidate)}
            >
              Choose {candidate.title}
            </button>
          ))}
        </div>
      )}
      <details>
        <summary className="cursor-pointer text-sm font-semibold">
          Choose another catalog game
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
        <div className="mt-2 flex flex-wrap gap-2">
          {search.data?.results
            .filter((game) => Number.isInteger(game.id))
            .map((game) => (
              <button
                key={game.id}
                className={button}
                disabled={disabled}
                onClick={() =>
                  onProposal({
                    id: game.id!,
                    title: game.name,
                    platforms: game.platforms ?? [],
                    released: game.released,
                    confidence: "likely",
                  })
                }
              >
                Choose {game.name}
              </button>
            ))}
        </div>
      </details>
      <button
        className={button}
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

export function LibraryCatalogMatches() {
  const client = useQueryClient();
  const [includeLinked, setIncludeLinked] = useState(false);
  const [proposals, setProposals] = useState<Record<string, LibraryCatalogSuggestion>>({});
  const [decisions, setDecisions] = useState<Record<string, LibraryCatalogDecision>>({});
  const [confirmation, setConfirmation] = useState<LibraryCatalogDecision[] | null>(null);
  const [message, setMessage] = useState("");
  const preview = useMutation({
    mutationFn: () => previewLibraryCatalogMatches(includeLinked),
    onSuccess: (data) => {
      setDecisions({});
      setProposals(
        Object.fromEntries(
          data.items
            .filter((row) => row.suggestions.length)
            .map((row) => [row.game_id, row.suggestions[0]]),
        ),
      );
      setMessage("");
    },
  });
  const apply = useMutation({
    mutationFn: (choices: LibraryCatalogDecision[]) => applyLibraryCatalogMatches(choices),
    onSuccess: ({ updated }) => {
      setMessage(`Updated ${updated} library entries. Your source records are preserved.`);
      setDecisions({});
      setProposals({});
      preview.reset();
    },
    onError: () => {
      setDecisions({});
      setProposals({});
      preview.reset();
    },
    onSettled: () =>
      Promise.all(
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
      ),
  });
  const selected = Object.values(decisions);
  const uncertainCount = selected.filter(
    (row) =>
      row.action === "link" &&
      (proposals[row.game_id]?.confidence !== "exact" ||
        preview.data?.items.find((item) => item.game_id === row.game_id)?.status !== "matched"),
  ).length;
  const busy = preview.isPending || apply.isPending;
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
      className="mb-6 space-y-4 rounded-xl border border-primary/30 bg-primary/5 p-4"
      aria-label="Match library to catalog"
    >
      <div>
        <h2 className="text-lg font-bold">Match your library to the catalog</h2>
        <p className="text-sm text-muted-foreground">
          Find suggestions for PlayStation imports and manual entries. Review individually or
          confirm all matches, including uncertain ones.
        </p>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={includeLinked}
          disabled={busy}
          onChange={(event) => setIncludeLinked(event.target.checked)}
        />
        Include linked entries for correction
      </label>
      <button
        className={button}
        disabled={busy}
        onClick={() => {
          apply.reset();
          preview.mutate();
        }}
      >
        {preview.isPending ? "Finding catalog matches…" : "Find catalog matches"}
      </button>
      {preview.isPending && (
        <p role="status" className="text-sm">
          Searching the catalog. Larger libraries can take a moment.
        </p>
      )}
      {(preview.isError || apply.isError) && (
        <p role="alert" className="text-sm text-red-600">
          {(preview.error ?? apply.error) instanceof Error
            ? (preview.error ?? apply.error)?.message
            : "Could not update catalog links. Try again."}
        </p>
      )}
      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
      {preview.data && (
        <>
          <p className="text-sm">
            {preview.data.items.length} entries checked. Nothing changes until you apply your
            choices.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              className={button}
              disabled={busy}
              onClick={() =>
                setDecisions(
                  Object.fromEntries(
                    preview
                      .data!.items.filter((item) => proposals[item.game_id])
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
          <div className="max-h-[65vh] space-y-3 overflow-y-auto pr-1">
            {preview.data.items.map((item) => (
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

export function LibraryCatalogMatchLauncher() {
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-5">
      <button className={button} onClick={() => setOpen(!open)} aria-expanded={open}>
        {open ? "Close catalog matching" : "Match library to catalog"}
      </button>
      {open && (
        <div className="mt-3">
          <LibraryCatalogMatches />
        </div>
      )}
    </div>
  );
}
