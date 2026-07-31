import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import {
  Chip,
  EmptyState,
  ErrorState,
  InlineError,
  Panel,
  RowSkeletonList,
  SectionHeader,
} from "@/components/ui-bits";
import { confirmPsnImport, previewPsnImport } from "@/lib/api";
import { ArrowLeft, ArrowRight, Check, FileUp, Loader2, RotateCcw, Upload } from "lucide-react";

export const Route = createFileRoute("/psn-import")({
  head: () => ({
    meta: [
      { title: "Import PlayStation library — Playfinder" },
      {
        name: "description",
        content:
          "Upload a PlayStation export file, preview the detected games and import them into your Playfinder library.",
      },
      { property: "og:title", content: "Import PlayStation library — Playfinder" },
      {
        property: "og:description",
        content: "Bring your PlayStation games into Playfinder in four steps.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PsnImportPage,
});

type Step = "upload" | "preview" | "confirm" | "result";
type Phase = "idle" | "loading" | "error";

const steps: { key: Step; label: string }[] = [
  { key: "upload", label: "Upload export" },
  { key: "preview", label: "Preview games" },
  { key: "confirm", label: "Confirm import" },
  { key: "result", label: "Result" },
];

function Stepper({ current }: { current: Step }) {
  const idx = steps.findIndex((s) => s.key === current);
  return (
    <ol className="mb-8 flex flex-wrap items-center gap-2">
      {steps.map((s, i) => {
        const done = i < idx;
        const active = i === idx;
        return (
          <li key={s.key} className="flex items-center gap-2">
            <span
              className={`label-mono flex items-center gap-2 rounded-full border px-3 py-1.5 transition ${
                active
                  ? "border-primary/40 bg-primary/15 text-primary"
                  : done
                    ? "border-border bg-foreground/5 text-foreground"
                    : "border-border text-muted-foreground"
              }`}
            >
              {done ? <Check className="size-3" /> : <span>{i + 1}</span>}
              {s.label}
            </span>
            {i < steps.length - 1 && <span className="h-px w-4 bg-border sm:w-8" aria-hidden />}
          </li>
        );
      })}
    </ol>
  );
}

function PsnImportPage() {
  const [step, setStep] = useState<Step>("upload");
  const [phase, setPhase] = useState<Phase>("idle");
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const client = useQueryClient();
  const [rows, setRows] = useState<
    {
      id: string;
      title: string;
      matched: boolean;
      platform?: string;
    }[]
  >([]);
  const [selected, setSelected] = useState<string[]>([]);
  const preview = useMutation({
    mutationFn: previewPsnImport,
    onSuccess: (data) => {
      const next = data.games.map((title) => ({ id: title, title, matched: true }));
      setRows(next);
      setSelected(next.map((game) => game.id));
      setPhase("idle");
      setStep("preview");
    },
    onError: (error) => {
      setFileError(error instanceof Error ? error.message : "We couldn't read that file.");
      setPhase("error");
    },
  });
  const confirm = useMutation({
    mutationFn: confirmPsnImport,
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["library"] });
      client.invalidateQueries({ queryKey: ["library-overview"] });
      setStep("result");
    },
  });
  const inputRef = useRef<HTMLInputElement>(null);

  function parseFile(file: File) {
    const name = file.name;
    setFileName(name);
    setFileError(null);
    setPhase("loading");
    preview.mutate(file);
  }

  function toggle(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  return (
    <AppShell>
      <Link
        to="/account"
        className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to profile
      </Link>

      <div className="mx-auto max-w-3xl">
        <p className="label-mono mb-3 text-primary">PlayStation</p>
        <h1 className="text-4xl font-bold tracking-[-0.03em]">Import your library</h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          PlayStation has no public library API, so Playfinder imports from an export file you
          download from your PlayStation account.
        </p>

        <div className="mt-8">
          <Stepper current={step} />
        </div>

        {/* Step 1 — upload */}
        {step === "upload" && (
          <Panel className="p-6">
            <SectionHeader title="Upload export" hint="XLSX, CSV or JSON, up to 10 MB" />
            {phase === "error" ? (
              <div className="space-y-4">
                <InlineError>{fileError ?? "We couldn't read that file."}</InlineError>
                <button
                  onClick={() => setPhase("idle")}
                  className="rounded-xl border border-border px-4 py-2 text-sm font-bold transition hover:border-primary/50"
                >
                  Try another file
                </button>
              </div>
            ) : phase === "loading" || confirm.isPending ? (
              <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-surface-2 py-14">
                <Loader2 className="size-5 animate-spin text-primary" />
                <p className="text-sm font-semibold">Reading {fileName}…</p>
                <p className="label-mono text-muted-foreground">Parsing entries</p>
              </div>
            ) : (
              <>
                <button
                  onClick={() => inputRef.current?.click()}
                  className="flex w-full flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-surface-2 px-6 py-14 text-center transition hover:border-primary/50"
                >
                  <span className="grid size-11 place-items-center rounded-xl bg-foreground/5 text-muted-foreground">
                    <FileUp className="size-5" />
                  </span>
                  <span className="text-sm font-bold">Choose an export file</span>
                  <span className="text-xs text-muted-foreground">
                    or drop it here — .csv, .json
                  </span>
                </button>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".xlsx,.csv,.json"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    if (!/\.(xlsx|csv|json)$/i.test(f.name)) {
                      setFileError("Only .xlsx, .csv and .json exports are supported.");
                      return;
                    }
                    parseFile(f);
                  }}
                />
                {fileError && (
                  <div className="mt-3">
                    <InlineError>{fileError}</InlineError>
                  </div>
                )}
              </>
            )}
          </Panel>
        )}

        {/* Step 2 — preview */}
        {step === "preview" && (
          <Panel className="p-6">
            <SectionHeader
              title="Preview games"
              hint={fileName ? `Parsed from ${fileName}` : undefined}
            />
            {phase === "loading" ? (
              <RowSkeletonList count={4} />
            ) : rows.length === 0 ? (
              <EmptyState
                icon={<Upload className="size-5" />}
                title="No games found in this export"
                description="The file parsed correctly but contained no library entries."
                action={
                  <button
                    onClick={() => {
                      setStep("upload");
                    }}
                    className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
                  >
                    Upload another file
                  </button>
                }
              />
            ) : (
              <>
                <div className="space-y-2">
                  {rows.map((g) => (
                    <label
                      key={g.id}
                      className="flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-surface-2 p-4"
                    >
                      <input
                        type="checkbox"
                        checked={selected.includes(g.id)}
                        onChange={() => toggle(g.id)}
                        disabled={!g.matched}
                        className="size-4 accent-[var(--primary)]"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold">{g.title}</p>
                        <p className="label-mono mt-1 text-muted-foreground">{g.platform}</p>
                      </div>
                      {g.matched ? (
                        <Chip tone="primary">Matched</Chip>
                      ) : (
                        <Chip tone="outline">No catalog match</Chip>
                      )}
                    </label>
                  ))}
                </div>
                <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                  <p className="label-mono text-muted-foreground">
                    {selected.length} of {rows.length} selected
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setStep("upload")}
                      className="rounded-xl border border-border px-4 py-2 text-sm font-bold transition hover:border-primary/50"
                    >
                      Back
                    </button>
                    <button
                      disabled={selected.length === 0}
                      onClick={() => setStep("confirm")}
                      className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
                    >
                      Continue <ArrowRight className="size-4" />
                    </button>
                  </div>
                </div>
              </>
            )}
          </Panel>
        )}

        {/* Step 3 — confirm */}
        {step === "confirm" && (
          <Panel className="p-6">
            <SectionHeader
              title="Confirm import"
              hint="Existing library entries won't be duplicated"
            />
            {phase === "error" ? (
              <ErrorState
                title="Import failed"
                description="Nothing was changed in your library. You can retry safely."
                onRetry={() => setPhase("idle")}
              />
            ) : phase === "loading" ? (
              <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-surface-2 py-14">
                <Loader2 className="size-5 animate-spin text-primary" />
                <p className="text-sm font-semibold">Importing {selected.length} games…</p>
              </div>
            ) : (
              <>
                <div className="rounded-xl border border-border bg-surface-2 p-5">
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                    <div>
                      <p className="label-mono text-muted-foreground">To import</p>
                      <p className="mt-1.5 font-display text-2xl font-bold">{selected.length}</p>
                    </div>
                    <div>
                      <p className="label-mono text-muted-foreground">Skipped</p>
                      <p className="mt-1.5 font-display text-2xl font-bold">
                        {rows.length - selected.length}
                      </p>
                    </div>
                    <div>
                      <p className="label-mono text-muted-foreground">Source</p>
                      <p className="mt-1.5 truncate font-display text-2xl font-bold">PlayStation</p>
                    </div>
                  </div>
                </div>
                <div className="mt-6 flex justify-end gap-2">
                  <button
                    onClick={() => setStep("preview")}
                    className="rounded-xl border border-border px-4 py-2 text-sm font-bold transition hover:border-primary/50"
                  >
                    Back
                  </button>
                  <button
                    onClick={() => confirm.mutate(selected)}
                    className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition hover:opacity-90"
                  >
                    Import {selected.length} games
                  </button>
                </div>
              </>
            )}
          </Panel>
        )}

        {/* Step 4 — result */}
        {step === "result" && (
          <Panel className="ember-glow grain p-6">
            <div className="relative flex flex-col items-center py-8 text-center">
              <span className="grid size-12 place-items-center rounded-2xl bg-primary/15 text-primary">
                <Check className="size-6" />
              </span>
              <h2 className="mt-4 text-2xl font-bold tracking-tight">Import complete</h2>
              <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                {selected.length} PlayStation games were added to your library. You can re-run the
                import any time to pick up new titles.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                <Link
                  to="/library"
                  className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition hover:opacity-90"
                >
                  Open library
                </Link>
                <button
                  onClick={() => {
                    setStep("upload");
                    setFileName(null);
                  }}
                  className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-bold transition hover:border-primary/50"
                >
                  <RotateCcw className="size-4" /> Import another file
                </button>
              </div>
            </div>
          </Panel>
        )}
      </div>
    </AppShell>
  );
}
