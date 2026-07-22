import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Chip, SectionHeader } from "@/components/ui-bits";
import { getDashboard, syncSteamLibrary } from "@/lib/api";
import { lovableQueryKeys } from "@/lib/lovable-data";
export const Route = createFileRoute("/steam")({ component: SteamPage });
const icon = (id: number, hash: string) =>
  `https://media.steampowered.com/steamcommunity/public/images/apps/${id}/${hash}.jpg`;
function SteamPage() {
  const c = useQueryClient();
  const q = useQuery({
    queryKey: lovableQueryKeys.dashboard,
    queryFn: getDashboard,
  });
  const b = q.data?.steam;
  const l = b?.data && "steam" in b.data ? b.data : null;
  const a = l?.steam;
  const games = l?.games ?? [];
  const sync = useMutation({
    mutationFn: syncSteamLibrary,
    onSuccess: () =>
      c.invalidateQueries({ queryKey: lovableQueryKeys.dashboard }),
  });
  if ((q.error as { status?: number } | null)?.status === 401)
    return (
      <AppShell>
        <Link to="/login">Sign in</Link>
      </AppShell>
    );
  if (b?.status === "not_connected" || !a?.linked)
    return (
      <AppShell>
        <SectionHeader
          title="Steam integration"
          hint={b?.message || "Connect Steam to view your library."}
        />
        <Link to="/steam">Connect Steam</Link>
      </AppShell>
    );
  return (
    <AppShell>
      <SectionHeader
        title="Steam integration"
        hint="Steam playtime and the 20 most-played games."
      />
      <div className="rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/15 to-transparent p-8">
        <p>Connected · {a.persona_name}</p>
        <h3 className="mt-3 text-3xl font-extrabold">
          {games.length} games synced
        </h3>
        <button
          onClick={() => sync.mutate()}
          className="mt-6 rounded-lg bg-primary px-4 py-2 font-bold text-primary-foreground"
        >
          Sync now
        </button>
      </div>
      <div className="mt-10">
        <SectionHeader title="Steam library" hint="Showing up to 20 games" />
        {games.slice(0, 20).map((g) => (
          <div
            key={g.appid}
            className="mb-2 flex items-center gap-3 rounded-lg border border-border bg-surface p-3"
          >
            {g.img_icon_url ? (
              <img
                src={icon(g.appid, g.img_icon_url)}
                alt={`${g.name} icon`}
                className="size-10 rounded object-cover"
              />
            ) : (
              <div className="size-10 rounded bg-muted" />
            )}
            <span className="flex-1">{g.name}</span>
            <Chip tone="primary">{Math.round(g.playtime_forever / 60)}h</Chip>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
