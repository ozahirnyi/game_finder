import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { Chip, SectionHeader } from "@/components/ui-bits";
import {
  getDashboard,
  getSteamLinkUrl,
  isAuthenticated,
  syncSteamLibrary,
} from "@/lib/api";
import { lovableQueryKeys } from "@/lib/lovable-data";

export type SteamLibraryPanelProps = {
  linked?: "1";
  error?: string;
};

const icon = (id: number, hash: string) =>
  `https://media.steampowered.com/steamcommunity/public/images/apps/${id}/${hash}.jpg`;

export function SteamLibraryPanel({ linked, error }: SteamLibraryPanelProps) {
  const c = useQueryClient();
  const authenticated = isAuthenticated();
  const q = useQuery({
    queryKey: lovableQueryKeys.dashboard,
    queryFn: getDashboard,
    enabled: authenticated,
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
  const connect = useMutation({
    mutationFn: getSteamLinkUrl,
    onSuccess: ({ url }) => window.location.assign(url),
  });

  useEffect(() => {
    if (linked === "1") {
      c.invalidateQueries({ queryKey: lovableQueryKeys.dashboard });
      c.invalidateQueries({ queryKey: lovableQueryKeys.steam });
    }
  }, [c, linked]);

  if (!authenticated)
    return (
      <>
        <SectionHeader
          title="Steam integration"
          hint="Sign in before connecting your Steam library."
        />
        <Link to="/login">Sign in</Link>
      </>
    );
  if ((q.error as { status?: number } | null)?.status === 401)
    return <Link to="/login">Sign in</Link>;
  if (b?.status === "not_connected" || !a?.linked)
    return (
      <>
        <SectionHeader
          title="Steam integration"
          hint={b?.message || "Connect Steam to view your library."}
        />
        {linked === "1" && (
          <p role="status" className="mb-3 text-sm text-primary">
            Steam account connected. Your library is ready to sync.
          </p>
        )}
        {(error || connect.error) && (
          <p role="alert" className="mb-3 text-sm text-destructive">
            {error || "Could not open Steam. Please try again."}
          </p>
        )}
        <button
          type="button"
          onClick={() => connect.mutate()}
          disabled={connect.isPending}
          className="rounded-lg bg-primary px-4 py-2 font-bold text-primary-foreground disabled:opacity-60"
        >
          {connect.isPending ? "Opening Steam…" : "Connect Steam"}
        </button>
      </>
    );
  return (
    <>
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
    </>
  );
}
