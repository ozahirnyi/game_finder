import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Chip, SectionHeader } from "@/components/ui-bits";
import { getSteamAccount as getSteamMe, getSteamLibrary, syncSteamLibrary } from "@/lib/api";
import { lovableQueryKeys } from "@/lib/lovable-data";
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

function protectedState(error: unknown) {
  const status = (error as { status?: number } | null)?.status;
  return status === 401 ? "sign-in" : status === 409 ? "connect-steam" : "error";
}

function SteamPage() {
  const queryClient = useQueryClient();
  const accountQuery = useQuery({ queryKey: lovableQueryKeys.steam, queryFn: getSteamMe });
  const libraryQuery = useQuery({
    queryKey: lovableQueryKeys.steamLibrary,
    queryFn: getSteamLibrary,
    enabled: accountQuery.data?.linked !== false,
  });
  const syncMutation = useMutation({
    mutationFn: syncSteamLibrary,
    onSuccess: (library) => {
      queryClient.setQueryData(lovableQueryKeys.steamLibrary, library);
      queryClient.setQueryData(lovableQueryKeys.steam, library.steam);
    },
  });
  const state = protectedState(accountQuery.error ?? libraryQuery.error);
  const steam = libraryQuery.data?.steam ?? accountQuery.data;
  const games = libraryQuery.data?.games ?? [];
  const totalPlaytime = games.reduce((total, game) => total + game.playtime_forever, 0);

  if (state === "sign-in" || state === "connect-steam" || steam?.linked === false) {
    return (
      <AppShell>
        <SectionHeader
          title="Steam integration"
          hint={state === "sign-in" ? "Sign in to view your Steam connection." : "Connect Steam to view your library."}
        />
        <div className="relative overflow-hidden rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/15 to-transparent p-8">
          <p className="text-sm text-muted-foreground">
            {state === "sign-in" ? "Your session is signed out." : "Your Steam account is not linked."}
          </p>
          <Link to="/steam" className="mt-4 inline-block rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">
            Connect Steam
          </Link>
        </div>
      </AppShell>
    );
  }

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
                {steam?.linked ? `Connected${steam.persona_name ? ` · ${steam.persona_name}` : ""}` : "Loading Steam connection"}
              </span>
            </div>
            <h3 className="text-3xl font-extrabold tracking-tight">
              {games.length} games synced
            </h3>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              Only library records returned by Steam are shown below.
            </p>
            <div className="mt-8 grid grid-cols-3 gap-6 border-t border-border pt-6 font-mono">
              {[
                { l: "Games", v: games.length, i: Library },
                { l: "Steam ID", v: steam?.steam_id ?? "—", i: Users },
                { l: "Playtime", v: `${Math.round(totalPlaytime / 60)}h`, i: RefreshCw },
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
              <button onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending} className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">
                Sync now
              </button>
              <button disabled title="Disconnect is not available from this screen." className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-bold">
                Disconnect
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-border bg-surface p-6">
          <Shield className="mb-4 size-5 text-primary" />
          <h4 className="mb-2 font-bold">Privacy in plain words</h4>
          <ul className="space-y-3 text-sm text-muted-foreground">
            <li className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-primary" /> Read-only. We never post or modify anything on Steam.</li>
            <li className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-primary" /> Only your library, wishlist, and playtime are used.</li>
            <li className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-primary" /> Friends only see what you allow in your privacy settings.</li>
            <li className="flex gap-2"><Lock className="mt-0.5 size-4 shrink-0 text-primary" /> Disconnect anytime — we wipe your synced data within 24 hours.</li>
          </ul>
        </div>
      </div>

      <div className="mt-10">
        <SectionHeader title="Steam library" />
        <div className="space-y-2 font-mono text-xs">
          {libraryQuery.isLoading ? <p className="text-muted-foreground">Loading library…</p> : games.length ? games.map((game) => (
            <div key={game.appid} className="flex items-center gap-4 rounded-lg border border-border bg-surface px-4 py-2.5">
              <Chip tone="primary">{game.playtime_forever}m</Chip>
              <span className="text-muted-foreground">{game.name}</span>
            </div>
          )) : <p className="text-muted-foreground">Steam returned no library games.</p>}
        </div>
      </div>
    </AppShell>
  );
}
