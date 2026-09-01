import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Panel, SectionHeader } from "./ui-bits";
import { confirmPsnImport, previewPsnImport, type PsnImportPreviewItem } from "../lib/api";

export function PsnImportFlow() {
  const client = useQueryClient();
  const [items, setItems] = useState<PsnImportPreviewItem[] | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [fileName, setFileName] = useState("");
  const preview = useMutation({
    mutationFn: previewPsnImport,
    onSuccess: (data) => {
      setItems(data.items);
      setSelectedIds(
        data.items.flatMap((item) =>
          item.status === "confirmed" && item.igdb_id ? [item.igdb_id] : [],
        ),
      );
    },
  });
  const confirm = useMutation({
    mutationFn: confirmPsnImport,
    onSuccess: () => client.invalidateQueries({ queryKey: ["library"] }),
  });
  const toggleGame = (igdbId: number) =>
    setSelectedIds((current) =>
      current.includes(igdbId) ? current.filter((id) => id !== igdbId) : [...current, igdbId],
    );

  return (
    <div className="mx-auto max-w-3xl">
      <SectionHeader
        title="Import PlayStation library"
        hint="Preview an export, then choose the games to add"
      />
      <Panel className="mt-4 p-6">
        {!items ? (
          <label className="flex min-h-56 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-surface-2 px-6 text-center hover:border-primary/50">
            <input
              className="sr-only"
              type="file"
              accept=".xlsx,.csv,.json"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                setFileName(file.name);
                preview.mutate(file);
              }}
            />
            <span className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">
              Choose an export file
            </span>
            <span className="mt-3 text-sm text-muted-foreground">
              {preview.isPending ? "Reading export…" : fileName || "CSV, JSON, or text export"}
            </span>
          </label>
        ) : (
          <>
            <p className="mb-4 text-sm text-muted-foreground">
              Confirmed catalog matches are selected. Review items are not imported automatically.
            </p>
            <div className="max-h-96 space-y-2 overflow-auto pr-1">
              {items
                .filter((item) => item.status === "confirmed" && item.igdb_id)
                .map((item) => (
                  <label
                    key={item.igdb_id}
                    className="flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-surface-2 p-3"
                  >
                    <input
                      checked={selectedIds.includes(item.igdb_id!)}
                      type="checkbox"
                      onChange={() => toggleGame(item.igdb_id!)}
                    />
                    <span className="text-sm font-medium">{item.title}</span>
                  </label>
                ))}
              {items
                .filter((item) => item.status !== "confirmed")
                .map((item) => (
                  <p
                    key={item.source_title}
                    className="rounded-xl border border-border bg-surface-2 p-3 text-sm text-muted-foreground"
                  >
                    {item.source_title} — not imported (needs review)
                  </p>
                ))}
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-60"
                disabled={selectedIds.length === 0 || confirm.isPending}
                onClick={() => confirm.mutate(selectedIds.map((catalog_id) => ({ catalog_id })))}
              >
                {confirm.isPending
                  ? "Importing…"
                  : `Import ${selectedIds.length} game${selectedIds.length === 1 ? "" : "s"}`}
              </button>
              <button
                className="rounded-lg border border-border px-4 py-2 text-sm font-bold"
                onClick={() => {
                  setItems(null);
                  setSelectedIds([]);
                }}
              >
                Choose another file
              </button>
            </div>
          </>
        )}
        {preview.error && (
          <p role="alert" className="mt-4 text-sm text-destructive">
            Could not read that export file.
          </p>
        )}
        {confirm.error && (
          <p role="alert" className="mt-4 text-sm text-destructive">
            Could not import the selected games.
          </p>
        )}
        {confirm.data && (
          <p role="status" className="mt-4 text-sm text-emerald-500">
            Imported {confirm.data.created + confirm.data.updated} of {confirm.data.total} games.
          </p>
        )}
      </Panel>
    </div>
  );
}
