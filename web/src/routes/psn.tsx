import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Chip, SectionHeader } from "@/components/ui-bits";
import { confirmPsnImport, previewPsnImport, type PsnImportPreview } from "@/lib/api";
import { Check, RefreshCw, Shield, Lock, Users, Trophy, Award } from "lucide-react";

export const Route = createFileRoute("/psn")({
  head: () => ({
    meta: [
      { title: "PlayStation Network — GameFinder" },
      {
        name: "description",
        content:
          "Connect PlayStation Network to sync your PS5 library, trophies, and co-op sessions with friends.",
      },
    ],
  }),
  component: PsnPage,
});

function PsnPage() {
  const fileInput = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<PsnImportPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  async function selectFile(file?: File) {
    if (!file) return;
    setBusy(true); setError(""); setMessage(""); setPreview(null);
    try { setPreview(await previewPsnImport(file)); } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not read the PlayStation export."); } finally { setBusy(false); }
  }
  async function sync() {
    if (!preview) { fileInput.current?.click(); return; }
    setBusy(true); setError("");
    try { const result = await confirmPsnImport(preview.games); setPreview(null); if (fileInput.current) fileInput.current.value = ""; setMessage(`PlayStation import complete: ${result.created} added, ${result.updated} updated, ${result.skipped} already in your library.`); } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not import PlayStation games."); } finally { setBusy(false); }
  }
  return (
    <AppShell>
      <SectionHeader
        title="PlayStation Network"
        hint="Sync your PSN library so we can match trophies, party sessions, and shared PS5 titles."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div
          className="relative overflow-hidden rounded-3xl border p-8 lg:col-span-2"
          style={{
            borderColor: "rgba(0, 112, 209, 0.35)",
            background:
              "linear-gradient(135deg, rgba(0,112,209,0.18) 0%, transparent 65%)",
          }}
        >
          <div
            className="absolute -right-10 -top-10 size-56 rounded-full blur-3xl"
            style={{ background: "rgba(0,112,209,0.25)" }}
          />
          <div className="relative">
            <div className="mb-4 flex items-center gap-2">
              <Check className="size-4" style={{ color: "#4aa3ff" }} />
              <span
                className="font-mono text-[11px] uppercase tracking-[0.25em]"
                style={{ color: "#4aa3ff" }}
              >
                Connected · alex_v_ps · Last sync 12m ago
              </span>
            </div>
            <h3 className="text-3xl font-extrabold tracking-tight">
              128 PS5 games · 47 platinums
            </h3>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              We match your PSN library with friends' PS accounts, surface Play Together
              opportunities, and cross-reference PS Plus catalog with your wishlist.
            </p>
            <div className="mt-8 grid grid-cols-3 gap-6 border-t border-border pt-6 font-mono">
              {[
                { l: "PS games", v: 128, i: Trophy },
                { l: "Platinums", v: 47, i: Award },
                { l: "PS friends", v: 21, i: Users },
              ].map((s) => (
                <div key={s.l}>
                  <s.i className="mb-2 size-4" style={{ color: "#4aa3ff" }} />
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    {s.l}
                  </p>
                  <p className="text-xl font-black">{s.v}</p>
                </div>
              ))}
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <button
                disabled={busy}
                onClick={sync}
                className="rounded-lg px-4 py-2 text-sm font-bold text-white"
                style={{ background: "#0070d1" }}
              >
                <RefreshCw className="mr-1.5 inline size-3.5" /> Sync now
              </button>
              <input ref={fileInput} aria-label="Choose PSN export" hidden type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => selectFile(event.target.files?.[0])} />
              <button className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-bold">
                Disconnect
              </button>
              <button className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-bold">
                Manage PS Plus
              </button>
            </div>
            {preview ? <div className="mt-4 text-sm text-muted-foreground">{preview.games.map((game) => <p key={game}>{game}</p>)}</div> : null}
            {error ? <div className="mt-4 text-sm text-muted-foreground"><p>{error}</p><button onClick={sync} className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-bold">Retry import</button></div> : null}
            {message ? <p className="mt-4 text-sm text-muted-foreground">{message}</p> : null}
          </div>
        </div>

        <div className="rounded-3xl border border-border bg-surface p-6">
          <Shield className="mb-4 size-5" style={{ color: "#4aa3ff" }} />
          <h4 className="mb-2 font-bold">What we read</h4>
          <ul className="space-y-3 text-sm text-muted-foreground">
            <li className="flex gap-2">
              <Check className="mt-0.5 size-4 shrink-0" style={{ color: "#4aa3ff" }} />
              Owned games, trophy list, and playtime (read-only).
            </li>
            <li className="flex gap-2">
              <Check className="mt-0.5 size-4 shrink-0" style={{ color: "#4aa3ff" }} />
              Online presence and friends list for LFG matching.
            </li>
            <li className="flex gap-2">
              <Check className="mt-0.5 size-4 shrink-0" style={{ color: "#4aa3ff" }} />
              PS Plus tier so we surface catalog freebies you already have access to.
            </li>
            <li className="flex gap-2">
              <Lock className="mt-0.5 size-4 shrink-0" style={{ color: "#4aa3ff" }} />
              We never send party invites or messages on your behalf.
            </li>
          </ul>
        </div>
      </div>

      <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <SectionHeader title="Recent PSN activity" />
          <div className="space-y-2 font-mono text-xs">
            {[
              { t: "12m ago", m: "Sync complete · 128 titles · +1 trophy" },
              { t: "1h ago", m: "Earned trophy: Path of the Furies (Helldivers 2)" },
              { t: "3h ago", m: "Party with Marcus, Alex (2h 14m)" },
              { t: "Yesterday", m: "PS Plus Essential renewed" },
            ].map((r) => (
              <div
                key={r.t}
                className="flex items-center gap-4 rounded-lg border border-border bg-surface px-4 py-2.5"
              >
                <Chip tone="primary">{r.t}</Chip>
                <span className="text-muted-foreground">{r.m}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <SectionHeader title="Cross-play matches" hint="Friends on PS5 that share PC titles with you." />
          <div className="space-y-2">
            {[
              { name: "Marcus V.", g: "Helldivers 2", cross: "PC ↔ PS5" },
              { name: "Maya R.", g: "Elden Ring", cross: "PS5 only" },
              { name: "Sasha K.", g: "Baldur's Gate 3", cross: "PC ↔ PS5" },
            ].map((r) => (
              <div
                key={r.name}
                className="flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-bold">{r.name}</p>
                  <p className="text-xs text-muted-foreground">{r.g}</p>
                </div>
                <Chip tone="outline">{r.cross}</Chip>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
