"use client";

import { useRef, useState } from "react";
import type { PsnImportPreview } from "@/lib/api";
import { confirmPsnImport, isAuthenticated, previewPsnImport } from "@/lib/api";
import { Button, Panel, StatePanel } from "@/components/ui";

export function PsnScreen() {
  const fileInput = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<PsnImportPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function selectFile(file?: File) {
    if (!file) return;
    setBusy(true); setPreview(null); setError(""); setMessage("");
    try { setPreview(await previewPsnImport(file)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not read the PlayStation export."); }
    finally { setBusy(false); }
  }
  async function importGames() {
    if (!preview?.games.length) return;
    setBusy(true); setError("");
    try {
      const result = await confirmPsnImport(preview.games);
      setPreview(null);
      if (fileInput.current) fileInput.current.value = "";
      setMessage(`PlayStation import complete: ${result.created} added, ${result.updated} updated, ${result.skipped} already in your library.`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not import PlayStation games."); }
    finally { setBusy(false); }
  }

  if (!isAuthenticated()) return <StatePanel kind="unauthenticated" title="Sign in to import PlayStation games" />;
  return <div className="stack"><header className="section-header"><p className="eyebrow">PlayStation</p><h1>Import your PSN library</h1><p>Upload the Excel export from PlayStation Account Management. Your original file is not stored.</p></header>
    {error ? <StatePanel kind="error" title="PSN import failed" detail={error} /> : null}{message ? <p className="alert success">{message}</p> : null}
    <Panel><label className="button" htmlFor="psn-export">Choose PSN export</label><input ref={fileInput} id="psn-export" aria-label="Choose PSN export" hidden type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" disabled={busy} onChange={(event) => selectFile(event.target.files?.[0])} />
      {busy ? <p>Reading export...</p> : null}
      {preview ? <div className="stack"><p>{preview.message ?? `${preview.total} games found.`}</p><ul>{preview.games.map((game) => <li key={game}>{game}</li>)}</ul><Button disabled={busy} onClick={importGames}>Import {preview.total} game{preview.total === 1 ? "" : "s"}</Button></div> : null}
    </Panel>
  </div>;
}
