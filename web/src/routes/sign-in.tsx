import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Panel } from "@/components/ui-bits";
import { SocialAuthButtons } from "@/components/SocialAuthButtons";
import { loginUser, setToken } from "@/lib/api";

import { Mail, Lock, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/sign-in")({
  head: () => ({
    meta: [
      { title: "Sign in — Playfinder" },
      {
        name: "description",
        content:
          "Sign in to Playfinder to sync your library, track wishlist price drops, and play with friends.",
      },
      { property: "og:title", content: "Sign in — Playfinder" },
      {
        property: "og:description",
        content: "Access your library, wishlist alerts, and friends on Playfinder.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SignInPage,
});

function SignInPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsPending(true);
    try {
      const { access_token } = await loginUser(email, password);
      setToken(access_token);
      await navigate({ to: "/account" });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Sign-in failed. Please try again.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-md py-6">
        <p className="label-mono mb-3 text-primary">Your account</p>
        <h1 className="text-4xl font-bold tracking-[-0.03em]">Sign in</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Browsing works without an account. Sign in to keep your wishlist and alerts.
        </p>

        <Panel className="mt-8 p-6">
          <SocialAuthButtons mode="sign-in" />
          <form className="mt-5 space-y-4" onSubmit={submit}>
            <label className="block">
              <span className="label-mono mb-2 block text-muted-foreground">Email</span>
              <div className="flex items-center gap-3 rounded-xl border border-border bg-surface-2 px-4 py-3">
                <Mail className="size-4 text-muted-foreground" />
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
              </div>
            </label>
            <label className="block">
              <span className="label-mono mb-2 block text-muted-foreground">Password</span>
              <div className="flex items-center gap-3 rounded-xl border border-border bg-surface-2 px-4 py-3">
                <Lock className="size-4 text-muted-foreground" />
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
              </div>
            </label>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <button disabled={isPending} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground transition hover:opacity-90 disabled:opacity-60">
              {isPending ? "Signing in…" : "Sign in"} <ArrowRight className="size-4" />
            </button>
          </form>
        </Panel>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          No account yet?{" "}
          <Link to="/sign-up" className="font-bold text-primary">
            Create one
          </Link>
        </p>
      </div>
    </AppShell>
  );
}
