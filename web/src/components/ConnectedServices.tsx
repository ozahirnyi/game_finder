import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Avatar } from "@/components/GameCover";
import { Chip, InlineError, Panel, SectionHeader } from "@/components/ui-bits";
import {
  getGoogleLinkUrl,
  getTelegramAccount,
  getTelegramLinkUrl,
  getSteamAccount,
  getSteamLinkUrl,
  syncSteamLibrary,
  type OAuthLoginUrl,
  type SteamAccount,
  type TelegramAccount,
  type TelegramLink,
  unlinkTelegramAccount,
  unlinkSteamAccount,
} from "@/lib/api";
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

export function ConnectedServices() {
  const client = useQueryClient();
  const steamQuery = useQuery({ queryKey: ["steam-account"], queryFn: getSteamAccount });
  const telegramQuery = useQuery({ queryKey: ["telegram-account"], queryFn: getTelegramAccount });
  const action = useMutation<
    OAuthLoginUrl | SteamAccount,
    Error,
    "google" | "link" | "sync" | "unlink"
  >({
    mutationFn: (kind: "google" | "link" | "sync" | "unlink") =>
      kind === "google"
        ? getGoogleLinkUrl()
        : kind === "link"
          ? getSteamLinkUrl()
          : kind === "sync"
            ? syncSteamLibrary()
            : unlinkSteamAccount(),
    onSuccess: (result) => {
      if ("url" in result) window.location.assign(result.url);
      client.invalidateQueries({ queryKey: ["steam-account"] });
      client.invalidateQueries({ queryKey: ["library"] });
      client.invalidateQueries({ queryKey: ["library-overview"] });
    },
  });
  const telegramAction = useMutation<TelegramLink | TelegramAccount, Error, "link" | "unlink">({
    mutationFn: (kind) => (kind === "link" ? getTelegramLinkUrl() : unlinkTelegramAccount()),
    onSuccess: (result) => {
      if ("url" in result && result.url) window.location.assign(result.url);
      client.invalidateQueries({ queryKey: ["telegram-account"] });
    },
  });
  const steam = steamQuery.data;
  const telegram = telegramQuery.data;
  return (
    <Panel className="p-6">
      <SectionHeader title="Connected services" hint="Sign-in methods and library sources" />
      <div className="space-y-3">
        <ServiceRow
          icon={<span className="font-display text-sm font-bold">G</span>}
          name="Google"
          connected={false}
          status="Use Google to sign in faster"
        >
          <button className={btnPrimary} onClick={() => action.mutate("google")}>
            Connect
          </button>
        </ServiceRow>
        <ServiceRow
          icon={<Gamepad2 className="size-4" />}
          name="Steam"
          connected={!!steam?.linked}
          status={
            steam?.linked ? (
              <span className="flex items-center gap-2">
                <Avatar
                  from="#c75f28"
                  to="#22243a"
                  name={steam.persona_name ?? "Steam"}
                  className="size-5 rounded-full"
                />
                <span className="text-foreground">{steam.persona_name ?? "Steam"}</span>
              </span>
            ) : (
              "Connect Steam to sync your owned games automatically"
            )
          }
        >
          {steam?.linked ? (
            <>
              <button
                className={btn}
                disabled={action.isPending}
                onClick={() => action.mutate("sync")}
              >
                {action.isPending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="size-3.5" />
                )}
                Sync now
              </button>
              <button className={btn} onClick={() => action.mutate("unlink")}>
                <Unlink className="size-3.5" /> Disconnect
              </button>
            </>
          ) : (
            <button className={btnPrimary} onClick={() => action.mutate("link")}>
              Connect Steam
            </button>
          )}
        </ServiceRow>
        <ServiceRow
          icon={<span className="font-display text-sm font-bold">TG</span>}
          name="Telegram"
          connected={!!telegram?.linked}
          status={
            !telegram?.configured
              ? "Telegram bot is not configured"
              : telegram?.linked
                ? `Connected${telegram.username ? ` as @${telegram.username}` : ""}`
                : "Connect Telegram to receive price alerts"
          }
        >
          {telegram?.linked ? (
            <button className={btn} disabled={telegramAction.isPending} onClick={() => telegramAction.mutate("unlink")}>
              <Unlink className="size-3.5" /> Disconnect
            </button>
          ) : (
            <button className={btnPrimary} disabled={!telegram?.configured || telegramAction.isPending} onClick={() => telegramAction.mutate("link")}>
              Connect Telegram
            </button>
          )}
        </ServiceRow>
        {action.error && (
          <div className="pl-1">
            <InlineError>Unable to update connected services.</InlineError>
          </div>
        )}
        <ServiceRow
          icon={<span className="font-display text-sm font-bold">PS</span>}
          name="PlayStation"
          connected={false}
          status="Import your PlayStation library from an export file"
        >
          <Link to="/psn-import" className={btnPrimary}>
            <Upload className="size-3.5" />
            Import library
          </Link>
        </ServiceRow>
      </div>
    </Panel>
  );
}
