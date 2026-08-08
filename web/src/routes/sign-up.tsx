import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Panel } from "@/components/ui-bits";
import { SocialAuthButtons } from "@/components/SocialAuthButtons";
import { registerUser } from "@/lib/api";

import { Mail, Lock, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/sign-up")({
  head: () => ({
    meta: [
      { title: "Create account — Playfinder" },
      {
        name: "description",
        content:
          "Create a free Playfinder account to save games, get price-drop alerts, and find co-op partners.",
      },
      { property: "og:title", content: "Create account — Playfinder" },
      {
        property: "og:description",
        content: "Save games, track price drops, and play together on Playfinder.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SignUpPage,
});

function SignUpPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [isCreated, setIsCreated] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsPending(true);
    try {
      await registerUser(email, password);
      setIsCreated(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Account creation failed. Please try again.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-md py-6">
        <p className="label-mono mb-3 text-primary">Your account</p>
        <h1 className="text-4xl font-bold tracking-[-0.03em]">Create account</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Free. Takes 20 seconds. Wishlist alerts included.
        </p>

        <Panel className="mt-8 p-6">
          <SocialAuthButtons mode="sign-up" />
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
                  placeholder="At least 8 characters"
                  className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
              </div>
            </label>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            {isCreated && <p role="status" className="text-sm text-primary">Account created. Please sign in to continue.</p>}
            <button disabled={isPending || isCreated} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground transition hover:opacity-90 disabled:opacity-60">
              {isPending ? "Creating account…" : "Create account"} <ArrowRight className="size-4" />
            </button>
          </form>
        </Panel>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already registered?{" "}
          <Link to="/sign-in" className="font-bold text-primary">
            Sign in
          </Link>
        </p>
      </div>
    </AppShell>
  );
}
