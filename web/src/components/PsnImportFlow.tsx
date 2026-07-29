import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Panel, SectionHeader } from "./ui-bits";
import { confirmPsnImport, previewPsnImport } from "../lib/api";

export function PsnImportFlow() {
  const client = useQueryClient();
  const [games, setGames] = useState<string[] | null>(null);
  const [fileName, setFileName] = useState("");
  const preview = useMutation({
    mutationFn: previewPsnImport,
    onSuccess: (data) => setGames(data.games),
  });
  const confirm = useMutation({
    mutationFn: confirmPsnImport,
    onSuccess: () => client.invalidateQueries({ queryKey: ["library"] }),
  });
  const toggleGame = (title: string) =>
    setGames((current) =>
      current?.includes(title)
        ? current.filter((game) => game !== title)
        : [...(current ?? []), title],
    );

  return (
    <div className="mx-auto max-w-3xl">
      <SectionHeader
        title="Import PlayStation library"
        hint="Preview an export, then choose the games to add"
      />
      <Panel className="mt-4 p-6">
        {!games ? (
          <label className="flex min-h-56 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-surface-2 px-6 text-center hover:border-primary/50">
            <input
              className="sr-only"
              type="file"
              accept=".csv,.json,.txt"
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
              Select the games you want to add. Nothing is imported until you confirm.
            </p>
            <div className="max-h-96 space-y-2 overflow-auto pr-1">
              {games.map((title) => (
                <label
                  key={title}
                  className="flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-surface-2 p-3"
                >
                  <input checked type="checkbox" onChange={() => toggleGame(title)} />
                  <span className="text-sm font-medium">{title}</span>
                </label>
              ))}
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-60"
                disabled={games.length === 0 || confirm.isPending}
                onClick={() => confirm.mutate(games)}
              >
                {confirm.isPending
                  ? "Importing…"
                  : `Import ${games.length} game${games.length === 1 ? "" : "s"}`}
              </button>
              <button
                className="rounded-lg border border-border px-4 py-2 text-sm font-bold"
                onClick={() => setGames(null)}
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
