import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  getGoogleLinkUrl,
  getSteamAccount,
  getSteamLinkUrl,
  syncSteamLibrary,
  unlinkSteamAccount,
} from "@/lib/api";
import { Panel, SectionHeader } from "./ui-bits";

export function ConnectedServices() {
  const client = useQueryClient();
  const steam = useQuery({ queryKey: ["steam-account"], queryFn: getSteamAccount });
  const action = useMutation({
    mutationFn: async (kind: "google" | "link" | "sync" | "unlink") => {
      if (kind === "google") return getGoogleLinkUrl();
      if (kind === "link") return getSteamLinkUrl();
      if (kind === "sync") return syncSteamLibrary();
      return unlinkSteamAccount();
    },
    onSuccess: (data) => {
      if ("url" in data) window.location.assign(data.url);
      client.invalidateQueries({ queryKey: ["steam-account"] });
      client.invalidateQueries({ queryKey: ["library"] });
    },
  });
  const button =
    "rounded-lg border border-border px-3 py-2 text-xs font-bold hover:border-primary/50 disabled:opacity-60";
  return (
    <Panel className="p-6">
      <SectionHeader title="Connected services" hint="Sign-in methods and library sources" />
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-2 p-4">
          <div>
            <b>Google</b>
            <p className="text-xs text-muted-foreground">Link Google to sign in faster</p>
          </div>
          <button className={button} onClick={() => action.mutate("google")}>
            Connect
          </button>
        </div>
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-2 p-4">
          <div>
            <b>Steam</b>
            <p className="text-xs text-muted-foreground">
              {steam.data?.linked
                ? `${steam.data.persona_name ?? "Steam"} · connected`
                : "Connect Steam to sync your library"}
            </p>
          </div>
          {steam.data?.linked ? (
            <div className="flex gap-2">
              <button className={button} onClick={() => action.mutate("sync")}>
                Sync now
              </button>
              <button className={button} onClick={() => action.mutate("unlink")}>
                Disconnect
              </button>
            </div>
          ) : (
            <button className={button} onClick={() => action.mutate("link")}>
              Connect Steam
            </button>
          )}
        </div>
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-2 p-4">
          <div>
            <b>PlayStation</b>
            <p className="text-xs text-muted-foreground">Import a library export file</p>
          </div>
          <Link className={button} to="/psn-import">
            Import library
          </Link>
        </div>
      </div>
      {action.error && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          Unable to update service.
        </p>
      )}
    </Panel>
  );
}
