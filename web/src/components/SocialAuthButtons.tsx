import { Loader2 } from "lucide-react";

export type SocialProvider = "google" | "steam";

export function SocialAuthButtons({
  pending,
  error,
  onStart,
}: {
  pending: SocialProvider | null;
  error: string | null;
  onStart: (provider: SocialProvider) => void;
}) {
  return (
    <div className="space-y-3">
      {(["google", "steam"] as const).map((provider) => (
        <button
          key={provider}
          type="button"
          onClick={() => onStart(provider)}
          disabled={pending !== null}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm font-bold hover:border-primary/50 disabled:opacity-60"
        >
          {pending === provider && <Loader2 className="size-4 animate-spin" />}
          {pending === provider
            ? "Redirecting…"
            : `Continue with ${provider === "google" ? "Google" : "Steam"}`}
        </button>
      ))}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex items-center gap-3 py-1">
        <span className="h-px flex-1 bg-border" />
        <span className="label-mono text-muted-foreground">or with email</span>
        <span className="h-px flex-1 bg-border" />
      </div>
    </div>
  );
}
