import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Upload, Check, Trophy } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { SectionHeader } from "@/components/ui-bits";
import {
  confirmPsnImport,
  getProfileSummary,
  previewPsnImport,
  type PsnImportPreview,
} from "@/lib/api";

export const Route = createFileRoute("/psn")({ component: PsnPage });

export function PsnPage() {
  const input = useRef<HTMLInputElement>(null);
  const summary = useQuery({
    queryKey: ["profile", "summary"],
    queryFn: getProfileSummary,
  });
  const [preview, setPreview] = useState<PsnImportPreview | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState("");
  const choose = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    setError("");
    setResult("");
    try {
      setPreview(await previewPsnImport(file));
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not read this PlayStation export.",
      );
    } finally {
      setBusy(false);
    }
  };
  const importGames = async () => {
    if (!preview) return;
    setBusy(true);
    setError("");
    try {
      const value = await confirmPsnImport(preview.games);
      setPreview(null);
      setResult(
        `${value.created} added, ${value.updated} updated, ${value.skipped} already present.`,
      );
      await summary.refetch();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not import these games.",
      );
    } finally {
      setBusy(false);
    }
  };
  const count = summary.data?.library.data?.psn_games;
  const unauthenticated =
    summary.isError && (summary.error as { status?: number })?.status === 401;
  return (
    <AppShell>
      <SectionHeader
        title="PlayStation library"
        hint="PlayStation does not provide the API this app needs, so you stay in control: download your account export and upload the .xlsx file here."
      />
      {unauthenticated ? (
        <div className="rounded-2xl border border-border bg-surface p-6">
          <p>Sign in to import your own PlayStation data.</p>
          <Link
            to="/login"
            className="mt-4 inline-block rounded-lg bg-primary px-4 py-2 font-bold text-primary-foreground"
          >
            Sign in
          </Link>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <section className="rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/15 to-transparent p-8 lg:col-span-2">
            <Trophy className="mb-4 size-6 text-primary" />
            <p className="font-mono text-[11px] uppercase tracking-widest text-primary">
              Your imported games
            </p>
            <h1 className="mt-2 text-4xl font-extrabold">
              {count === undefined ? "Loading…" : `${count} PSN games`}
            </h1>
            <p className="mt-3 max-w-xl text-sm text-muted-foreground">
              We only import the game titles you select from your export. Trophy
              progress, friends, PS Plus and activity are not claimed because
              the export/API does not reliably provide them.
            </p>
            <input
              ref={input}
              hidden
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(e) => choose(e.target.files?.[0])}
            />
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => input.current?.click()}
                disabled={busy}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
              >
                <Upload className="mr-2 inline size-4" />
                Choose export
              </button>
              {preview ? (
                <button
                  onClick={importGames}
                  disabled={busy}
                  className="rounded-lg border border-border px-4 py-2 text-sm font-bold"
                >
                  Import {preview.total} games
                </button>
              ) : null}
            </div>
            {preview ? (
              <div className="mt-5 rounded-xl border border-border bg-background/40 p-4 text-sm">
                <p className="font-bold">
                  Ready to import {preview.total} games
                </p>
                <p className="mt-1 text-muted-foreground">
                  {preview.games.slice(0, 8).join(" · ")}
                  {preview.total > 8 ? " …" : ""}
                </p>
              </div>
            ) : null}
            {result ? (
              <p className="mt-4 text-sm text-primary">
                <Check className="mr-1 inline size-4" />
                {result}
              </p>
            ) : null}
            {error ? (
              <p className="mt-4 text-sm text-destructive">{error}</p>
            ) : null}
          </section>
          <aside className="rounded-3xl border border-border bg-surface p-6">
            <h2 className="font-bold">How to import</h2>
            <ol className="mt-4 space-y-3 text-sm text-muted-foreground">
              <li>
                1. Open the{" "}
                <a
                  className="text-primary underline"
                  href="https://www.playstation.com/uk-ua/support/account/data-request/"
                  target="_blank"
                  rel="noreferrer"
                >
                  official PlayStation data-request guide
                </a>{" "}
                and sign in to Account Management.
              </li>
              <li>
                2. In <strong>Privacy Settings</strong>, choose{" "}
                <strong>Data Access Requests → Request Data</strong>.
              </li>
              <li>
                3. Wait for PlayStation’s second email (it can take up to 7
                days), then use its link to download the Excel file. The
                download link expires after 7 days.
              </li>
              <li>
                4. Return here, choose that unmodified <strong>.xlsx</strong>{" "}
                export, review detected titles and confirm the import.
              </li>
            </ol>
          </aside>
        </div>
      )}
    </AppShell>
  );
}
