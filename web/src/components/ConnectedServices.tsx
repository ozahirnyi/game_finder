import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Avatar } from "@/components/GameCover";
import { Chip, InlineError, Panel, SectionHeader } from "@/components/ui-bits";
import { connectedServices } from "@/lib/mockData";
import { Check, Gamepad2, Loader2, RefreshCw, Unlink, Upload } from "lucide-react";

function ServiceRow({
  icon,
  name,
  status,
  connected,
  children,
}: {
  icon: React.ReactNode;
  name: string;
  status: React.ReactNode;
  connected: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface-2 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-foreground/5 text-muted-foreground">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-bold">{name}</p>
            {connected ? (
              <Chip tone="primary">
                <Check className="mr-1 size-3" /> Connected
              </Chip>
            ) : (
              <Chip tone="outline">Not connected</Chip>
            )}
          </div>
          <div className="label-mono mt-1.5 text-muted-foreground">{status}</div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">{children}</div>
      </div>
    </div>
  );
}

const btn =
  "inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-bold transition hover:border-primary/50 disabled:opacity-60";
const btnPrimary =
  "inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground transition hover:opacity-90 disabled:opacity-60";

/** Identity + store connections. Purely presentational — wired up by the backend later. */
export function ConnectedServices() {
  const { google, steam, playstation } = connectedServices;
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  return (
    <Panel className="p-6">
      <SectionHeader title="Connected services" hint="Sign-in methods and library sources" />
      <div className="space-y-3">
        <ServiceRow
          icon={<span className="font-display text-sm font-bold">G</span>}
          name="Google"
          connected={google.state === "connected"}
          status={google.email ?? "Use Google to sign in faster"}
        >
          {google.state === "connected" ? (
            <button className={btn}>
              <Unlink className="size-3.5" /> Disconnect
            </button>
          ) : (
            <button className={btnPrimary}>Connect</button>
          )}
        </ServiceRow>

        <ServiceRow
          icon={<Gamepad2 className="size-4" />}
          name="Steam"
          connected={steam.state === "connected"}
          status={
            steam.state === "connected" ? (
              <span className="flex flex-wrap items-center gap-2">
                <Avatar
                  from={steam.avatarFrom}
                  to={steam.avatarTo}
                  name={steam.personaName ?? "Steam"}
                  className="size-5 rounded-full"
                />
                <span className="text-foreground">{steam.personaName}</span>
                <span>· {steam.gameCount ?? 0} games</span>
                <span>· Last sync {steam.lastSyncedAt ?? "—"}</span>
              </span>
            ) : (
              "Connect Steam to sync your owned games automatically"
            )
          }
        >
          {steam.state === "connected" ? (
            <>
              <button
                className={btn}
                disabled={syncing}
                onClick={() => {
                  setSyncError(null);
                  setSyncing(true);
                  window.setTimeout(() => {
                    setSyncing(false);
                    setSyncError("Sync isn't wired up yet.");
                  }, 900);
                }}
              >
                {syncing ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="size-3.5" />
                )}
                {syncing ? "Syncing…" : "Sync now"}
              </button>
              <button className={btn}>
                <Unlink className="size-3.5" /> Disconnect
              </button>
            </>
          ) : (
            <button className={btnPrimary}>Connect Steam</button>
          )}
        </ServiceRow>
        {syncError && (
          <div className="pl-1">
            <InlineError>{syncError}</InlineError>
          </div>
        )}

        <ServiceRow
          icon={<span className="font-display text-sm font-bold">PS</span>}
          name="PlayStation"
          connected={playstation.imported}
          status={
            playstation.imported
              ? `${playstation.gameCount ?? 0} imported games · imported ${playstation.importedAt ?? "—"}`
              : "Import your PlayStation library from an export file"
          }
        >
          <Link to="/psn-import" className={playstation.imported ? btn : btnPrimary}>
            <Upload className="size-3.5" />
            {playstation.imported ? "Re-import" : "Import library"}
          </Link>
        </ServiceRow>
      </div>
    </Panel>
  );
}
