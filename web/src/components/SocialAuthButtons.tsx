import { useState } from "react";
import { InlineError } from "@/components/ui-bits";
import { Loader2 } from "lucide-react";

type Provider = "google" | "steam";

function ProviderButton({
  provider,
  label,
  busy,
  disabled,
  onClick,
}: {
  provider: Provider;
  label: string;
  busy: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-busy={busy}
      className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm font-bold transition hover:border-primary/50 disabled:opacity-60"
    >
      {busy ? (
        <Loader2 className="size-4 animate-spin text-primary" />
      ) : provider === "google" ? (
        <span className="grid size-5 place-items-center rounded-full bg-foreground/10 font-display text-[11px] font-bold">
          G
        </span>
      ) : (
        <span className="grid size-5 place-items-center rounded-full bg-foreground/10 font-display text-[9px] font-bold">
          ST
        </span>
      )}
      {busy ? "Redirecting…" : label}
    </button>
  );
}

/** Social sign-in block with per-provider loading and error states. */
export function SocialAuthButtons({ mode }: { mode: "sign-in" | "sign-up" }) {
  const [pending, setPending] = useState<Provider | null>(null);
  const [errors, setErrors] = useState<Partial<Record<Provider, string>>>({});

  function start(provider: Provider) {
    setErrors((e) => ({ ...e, [provider]: undefined }));
    setPending(provider);
    window.setTimeout(() => {
      setPending(null);
      setErrors((e) => ({
        ...e,
        [provider]: `${provider === "google" ? "Google" : "Steam"} sign-in isn't connected yet.`,
      }));
    }, 1000);
  }

  const verb = mode === "sign-up" ? "Sign up" : "Continue";

  return (
    <div className="space-y-3">
      <div>
        <ProviderButton
          provider="google"
          label={`${verb} with Google`}
          busy={pending === "google"}
          disabled={pending !== null}
          onClick={() => start("google")}
        />
        {errors.google && (
          <div className="mt-2">
            <InlineError>{errors.google}</InlineError>
          </div>
        )}
      </div>
      <div>
        <ProviderButton
          provider="steam"
          label={`${verb} with Steam`}
          busy={pending === "steam"}
          disabled={pending !== null}
          onClick={() => start("steam")}
        />
        {errors.steam && (
          <div className="mt-2">
            <InlineError>{errors.steam}</InlineError>
          </div>
        )}
      </div>
      <div className="flex items-center gap-3 pt-1">
        <span className="h-px flex-1 bg-border" />
        <span className="label-mono text-muted-foreground">or with email</span>
        <span className="h-px flex-1 bg-border" />
      </div>
    </div>
  );
}
