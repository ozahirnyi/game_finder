import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Check, FileUp, Loader2, RotateCcw } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Chip, InlineError, Panel, SectionHeader } from "@/components/ui-bits";
import { confirmPsnImport, previewPsnImport, type PsnImportPreviewItem, type PsnImportSelection } from "@/lib/api";

export const Route = createFileRoute("/psn-import")({ component: PsnImportPage });

type Step = "upload" | "preview" | "confirm" | "result";
type Row = PsnImportPreviewItem & { decision: "catalog" | "raw" | "skip"; catalogId: number | null; restored: boolean };
const steps: { key: Step; label: string }[] = [{ key: "upload", label: "Upload export" }, { key: "preview", label: "Preview games" }, { key: "confirm", label: "Confirm import" }, { key: "result", label: "Result" }];

export function recommendedDecision(item: PsnImportPreviewItem): Row["decision"] {
  if (item.recommended_action === "catalog") return item.igdb_id ? "catalog" : "raw";
  return item.recommended_action;
}

export function mergePreviewRows(items: PsnImportPreviewItem[], previous: Row[] = []): Row[] {
  const previousByTitle = new Map(previous.map(row => [row.source_title, row]));
  return items.map(item => {
    const prior = previousByTitle.get(item.source_title);
    const restored = item.status === "suggested_skip" && Boolean(prior?.restored);
    if (!prior) return { ...item, decision: recommendedDecision(item), catalogId: item.igdb_id ?? null, restored: false };
    if (item.status === "suggested_skip" && !restored) return { ...item, decision: "skip", catalogId: null, restored: false };
    if (prior.decision === "skip" && !restored) return { ...item, decision: "skip", catalogId: item.igdb_id ?? null, restored };
    const keepManualCatalog = prior.decision === "catalog" && prior.catalogId != null;
    return {
      ...item,
      decision: keepManualCatalog ? "catalog" : recommendedDecision(item) === "skip" ? "raw" : recommendedDecision(item),
      catalogId: keepManualCatalog ? prior.catalogId : item.igdb_id ?? null,
      restored,
    };
  });
}

function Stepper({ step }: { step: Step }) {
  const active = steps.findIndex(item => item.key === step);
  return <ol className="mb-8 flex flex-wrap gap-2">{steps.map((item, index) => <li key={item.key} className={`label-mono rounded-full border px-3 py-1.5 ${index === active ? "border-primary/40 bg-primary/15 text-primary" : index < active ? "border-border bg-foreground/5" : "border-border text-muted-foreground"}`}>{index < active ? <Check className="mr-1 inline size-3" /> : `${index + 1}. `}{item.label}</li>)}</ol>;
}

function PsnImportPage() {
  const [step, setStep] = useState<Step>("upload");
  const [rows, setRows] = useState<Row[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const client = useQueryClient();
  const preview = useMutation({ mutationFn: previewPsnImport, onSuccess: data => { setRows(current => mergePreviewRows(data.items, current)); setStep("preview"); setError(null); }, onError: value => setError(value instanceof Error ? value.message : "Could not read export.") });
  const confirm = useMutation({ mutationFn: confirmPsnImport, onSuccess: () => { client.invalidateQueries({ queryKey: ["library"] }); setStep("result"); }, onError: value => setError(value instanceof Error ? value.message : "Could not import titles.") });
  const update = (token: string, patch: Partial<Row>) => setRows(current => current.map(row => row.candidate_token === token ? { ...row, ...patch } : row));
  const gameRows = rows.filter(row => row.status !== "suggested_skip" || row.restored);
  const suggestedNonGames = rows.filter(row => row.status === "suggested_skip" && !row.restored);
  const decisions: PsnImportSelection[] = rows.flatMap(row => row.decision === "catalog" && row.catalogId ? [{ candidate_token: row.candidate_token, action: "catalog" as const, catalog_id: row.catalogId }] : row.decision === "raw" ? [{ candidate_token: row.candidate_token, action: "raw" as const }] : []);
  const selectedCount = decisions.length;
  const returnToUpload = () => { setRows([]); setFileName(null); setUploadedFile(null); setError(null); if (input.current) input.current.value = ""; setStep("upload"); };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") { if (step === "confirm") setStep("preview"); else if (step === "preview" || step === "result") returnToUpload(); } };
    document.addEventListener("keydown", onKeyDown); return () => document.removeEventListener("keydown", onKeyDown);
  }, [step]);

  const selectAllGames = () => setRows(current => current.map(row => row.status === "suggested_skip" && !row.restored ? row : { ...row, decision: row.recommended_action === "catalog" && row.igdb_id ? "catalog" : "raw", catalogId: row.igdb_id ?? null }));
  const clearSelection = () => setRows(current => current.map(row => ({ ...row, decision: "skip" })));
  const retryCatalog = () => uploadedFile && preview.mutate(uploadedFile);

  function previewRow(row: Row) {
    const badge = row.status === "catalog_unavailable" ? "Catalog temporarily unavailable" : row.decision === "catalog" ? "Catalog match" : "PSN title";
    return <div key={row.candidate_token} className="rounded-xl border border-border bg-surface-2 p-4"><div className="flex items-start gap-3"><input aria-label={`Select ${row.source_title}`} type="checkbox" checked={row.decision !== "skip"} onChange={() => update(row.candidate_token, { decision: row.decision === "skip" ? (row.catalogId ? "catalog" : "raw") : "skip" })} className="mt-1 size-4 accent-[var(--primary)]" /><div className="min-w-0 flex-1"><p className="font-bold">{row.title ?? row.source_title}</p><p className="label-mono mt-1 text-muted-foreground">{row.source_title}</p>{row.reason && <p className="mt-1 text-xs text-muted-foreground">{row.reason}</p>}</div><Chip tone={row.decision === "skip" ? "outline" : "primary"}>{badge}</Chip></div>{row.suggestions.length > 0 && <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">{row.suggestions.map(item => <button key={item.id} onClick={() => update(row.candidate_token, { decision: "catalog", catalogId: item.id })} className="rounded-lg border border-border px-2 py-1 text-xs">Use {item.title}</button>)}<button onClick={() => update(row.candidate_token, { decision: "raw" })} className="rounded-lg border border-border px-2 py-1 text-xs">Import as PSN title</button></div>}</div>;
  }

  return <AppShell><Link to="/account" className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground"><ArrowLeft className="size-4" /> Back to profile</Link><div className="mx-auto max-w-3xl"><p className="label-mono mb-3 text-primary">PlayStation</p><h1 className="text-4xl font-bold tracking-[-0.03em]">Import your library</h1><p className="mt-2 max-w-xl text-sm text-muted-foreground">Upload your PlayStation export, review its matches, and decide exactly what to add.</p><div className="mt-8"><Stepper step={step} /></div>{error && <InlineError>{error}</InlineError>}{step === "upload" && <Panel className="p-6"><SectionHeader title="Upload export" hint="XLSX, CSV or JSON, up to 10 MB" /><button onClick={() => input.current?.click()} className="flex w-full flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-surface-2 px-6 py-14"><FileUp className="size-6 text-primary" /><span className="font-bold">Choose an export file</span><span className="text-xs text-muted-foreground">.xlsx, .csv or .json</span></button><input ref={input} type="file" accept=".xlsx,.csv,.json" className="hidden" onChange={event => { const file = event.target.files?.[0]; if (file) { setFileName(file.name); setUploadedFile(file); preview.mutate(file); } }} />{preview.isPending && <p className="mt-4 flex items-center gap-2"><Loader2 className="size-4 animate-spin" /> Reading {fileName}…</p>}</Panel>}{step === "preview" && <Panel className="p-6"><SectionHeader title="Preview games" hint={fileName ? `Parsed from ${fileName}` : undefined} /><div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface-2 p-3"><p className="text-sm text-muted-foreground">Plausible games are selected automatically; catalog results only add details.</p><div className="flex gap-2"><button onClick={selectAllGames} className="rounded-lg border border-border px-3 py-1.5 text-sm font-bold">Select all games</button><button onClick={clearSelection} className="rounded-lg border border-border px-3 py-1.5 text-sm font-bold">Clear selection</button><button disabled={!uploadedFile || preview.isPending} onClick={retryCatalog} className="rounded-lg border border-border px-3 py-1.5 text-sm font-bold">Retry catalog enrichment</button></div></div><div className="space-y-6"><section aria-label="Games to import"><h2 className="mb-2 text-sm font-bold">Games to import ({gameRows.length})</h2>{gameRows.map(previewRow)}</section><section aria-label="Suggested non-games"><details><summary className="cursor-pointer text-sm font-bold">Suggested non-games ({suggestedNonGames.length})</summary><div className="mt-2 space-y-2">{suggestedNonGames.map(row => <div key={row.candidate_token} className="rounded-xl border border-border p-4"><p className="font-bold">{row.source_title}</p><p className="text-xs text-muted-foreground">{row.reason}</p><button onClick={() => update(row.candidate_token, { restored: true, decision: "raw" })} className="mt-2 rounded-lg border border-border px-2 py-1 text-xs">Restore and select</button></div>)}</div></details></section></div><div className="mt-6 flex items-center justify-between"><p className="label-mono text-muted-foreground">{selectedCount} selected · {rows.length - selectedCount} skipped</p><div className="flex gap-2"><button onClick={returnToUpload} className="rounded-xl border border-border px-4 py-2 text-sm font-bold">Back</button><button disabled={!selectedCount} onClick={() => setStep("confirm")} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50">Continue <ArrowRight className="size-4" /></button></div></div></Panel>}{step === "confirm" && <Panel className="p-6"><SectionHeader title="Confirm import" hint="Existing library entries won't be duplicated" /><div className="rounded-xl border border-border bg-surface-2 p-5"><div className="grid grid-cols-3 gap-4"><div><p className="label-mono text-muted-foreground">Catalog</p><p className="text-2xl font-bold">{decisions.filter(item => item.action === "catalog").length}</p></div><div><p className="label-mono text-muted-foreground">PSN titles</p><p className="text-2xl font-bold">{decisions.filter(item => item.action === "raw").length}</p></div><div><p className="label-mono text-muted-foreground">Skipped</p><p className="text-2xl font-bold">{rows.length - selectedCount}</p></div></div></div><div className="mt-6 flex justify-end gap-2"><button disabled={confirm.isPending} onClick={() => setStep("preview")} className="rounded-xl border border-border px-4 py-2 text-sm font-bold">Back</button><button disabled={confirm.isPending} onClick={() => confirm.mutate(decisions)} className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50">{confirm.isPending ? "Importing…" : `Import ${selectedCount} games`}</button></div></Panel>}{step === "result" && <Panel className="p-6 text-center"><Check className="mx-auto size-8 text-primary" /><h2 className="mt-3 text-2xl font-bold">Import complete</h2><p className="mt-2 text-sm text-muted-foreground">Your selected PlayStation games are now in your library.</p><div className="mt-6 flex justify-center gap-2"><Link to="/library" className="rounded-xl bg-primary px-4 py-2 font-bold text-primary-foreground">Open library</Link><button onClick={returnToUpload} className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 font-bold"><RotateCcw className="size-4" /> Import another</button></div></Panel>}</div></AppShell>;
}
