import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Chip, SectionHeader } from "@/components/ui-bits";
import { currentUser } from "@/lib/mockData";
import { Check, RefreshCw, Shield, Lock, Users, Library } from "lucide-react";

export const Route = createFileRoute("/steam")({
  head: () => ({
    meta: [
      { title: "Steam Integration — GameFinder" },
      { name: "description", content: "Connect Steam to unlock shared-game tracking, friend compatibility, and co-op matchmaking." },
    ],
  }),
  component: SteamPage,
});

function SteamPage() {
  return (
    <AppShell>
      <SectionHeader
        title="Steam integration"
        hint="Sync your library so we can surface shared games and multiplayer opportunities."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="relative overflow-hidden rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/15 to-transparent p-8 lg:col-span-2">
          <div className="absolute -right-10 -top-10 size-48 rounded-full bg-primary/20 blur-3xl" />
          <div className="relative">
            <div className="mb-4 flex items-center gap-2">
              <Check className="size-4 text-primary" />
              <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-primary">
                Connected · Last sync 4m ago
              </span>
            </div>
            <h3 className="text-3xl font-extrabold tracking-tight">
              {currentUser.stats.library} games synced
            </h3>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              We refresh every 15 minutes. Your library, wishlist, and playtime feed
              the shared-games engine and AI recommendations.
            </p>
            <div className="mt-8 grid grid-cols-3 gap-6 border-t border-border pt-6 font-mono">
              {[
                { l: "Games", v: currentUser.stats.library, i: Library },
                { l: "Friends matched", v: 47, i: Users },
                { l: "Playtime", v: "2,140h", i: RefreshCw },
              ].map((s) => (
                <div key={s.l}>
                  <s.i className="mb-2 size-4 text-primary" />
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    {s.l}
                  </p>
                  <p className="text-xl font-black">{s.v}</p>
                </div>
              ))}
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <button className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">
                Sync now
              </button>
              <button className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-bold">
                Disconnect
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-border bg-surface p-6">
          <Shield className="mb-4 size-5 text-primary" />
          <h4 className="mb-2 font-bold">Privacy in plain words</h4>
          <ul className="space-y-3 text-sm text-muted-foreground">
            <li className="flex gap-2">
              <Check className="mt-0.5 size-4 shrink-0 text-primary" /> Read-only.
              We never post or modify anything on Steam.
            </li>
            <li className="flex gap-2">
              <Check className="mt-0.5 size-4 shrink-0 text-primary" /> Only your
              library, wishlist, and playtime are used.
            </li>
            <li className="flex gap-2">
              <Check className="mt-0.5 size-4 shrink-0 text-primary" /> Friends
              only see what you allow in your privacy settings.
            </li>
            <li className="flex gap-2">
              <Lock className="mt-0.5 size-4 shrink-0 text-primary" /> Disconnect
              anytime — we wipe your synced data within 24 hours.
            </li>
          </ul>
        </div>
      </div>

      <div className="mt-10">
        <SectionHeader title="Recent sync activity" />
        <div className="space-y-2 font-mono text-xs">
          {[
            { t: "4m ago", m: "Sync complete · 342 titles · +2 new" },
            { t: "19m ago", m: "Detected Helldivers 2 launched (2h session)" },
            { t: "1h ago", m: "Playtime updated for 8 titles" },
            { t: "3h ago", m: "Wishlist item added: Slay the Spire 2" },
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
    </AppShell>
  );
}
