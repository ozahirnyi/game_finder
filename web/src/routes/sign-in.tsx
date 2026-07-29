import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Panel } from "@/components/ui-bits";
import { SocialAuthButtons } from "@/components/SocialAuthButtons";

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
          <form className="mt-5 space-y-4" onSubmit={(e) => e.preventDefault()}>

            <label className="block">
              <span className="label-mono mb-2 block text-muted-foreground">Email</span>
              <div className="flex items-center gap-3 rounded-xl border border-border bg-surface-2 px-4 py-3">
                <Mail className="size-4 text-muted-foreground" />
                <input
                  type="email"
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
                  placeholder="••••••••"
                  className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
              </div>
            </label>
            <button className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground transition hover:opacity-90">
              Sign in <ArrowRight className="size-4" />
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
