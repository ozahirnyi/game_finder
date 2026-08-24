import { useState } from "react";
import type { PsnImportPreview, PsnImportResult } from "@/lib/api";
import { confirmPsnImport, previewPsnImport } from "@/lib/api";

export function PsnImportPanel() {
  const [preview, setPreview] = useState<PsnImportPreview | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [result, setResult] = useState<PsnImportResult | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function previewFile(file?: File) {
    if (!file) return;
    setBusy(true);
    setError("");
    setPreview(null);
    setResult(null);
    try {
      const next = await previewPsnImport(file);
      setPreview(next);
      setSelected(next.games);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not read the PSN export.");
    } finally {
      setBusy(false);
    }
  }

  function toggle(title: string) {
    setSelected((current) =>
      current.includes(title) ? current.filter((item) => item !== title) : [...current, title]
    );
  }

  async function importSelected() {
    if (!selected.length) return;
    setBusy(true);
    setError("");
    try {
      const next = await confirmPsnImport(selected);
      setResult(next);
      setPreview(null);
      setSelected([]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not import PSN games.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-3xl border border-border bg-surface p-6 sm:p-8">
      <p className="rounded-xl border border-primary/30 bg-primary/10 p-4 text-sm text-muted-foreground">
        This import reads only game purchases and activity included by PlayStation in this Excel file.
        It is not a complete PSN library sync and cannot include discs, PS Plus access, or trophies.
      </p>

      <div className="mt-6">
        <label className="inline-flex cursor-pointer rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition hover:opacity-90">
          Choose PSN Excel export
          <input
            aria-label="Choose PSN Excel export"
            className="sr-only"
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            disabled={busy}
            onChange={(event) => void previewFile(event.target.files?.[0])}
          />
        </label>
        {busy ? <p className="mt-3 text-sm text-muted-foreground">Reading PSN export…</p> : null}
      </div>

      {error ? <p role="alert" className="mt-4 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm">{error}</p> : null}

      {preview ? (
        <div className="mt-6">
          <p className="text-sm text-muted-foreground">
            {preview.message ?? `${preview.total} games found. Select the games to import.`}
          </p>
          <ul className="mt-4 space-y-2">
            {preview.games.map((game) => (
              <li key={game}>
                <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-surface-2 p-3 text-sm font-semibold">
                  <input aria-label={game} type="checkbox" checked={selected.includes(game)} onChange={() => toggle(game)} />
                  {game}
                </label>
              </li>
            ))}
          </ul>
          <button className="mt-5 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50" disabled={busy || !selected.length} onClick={() => void importSelected()}>
            Import {selected.length} game{selected.length === 1 ? "" : "s"}
          </button>
        </div>
      ) : null}

      {result ? <p className="mt-5 rounded-xl border border-primary/30 bg-primary/10 p-4 text-sm font-semibold">{result.created} added, {result.updated} updated, {result.skipped} already in your library.</p> : null}
    </section>
  );
}
