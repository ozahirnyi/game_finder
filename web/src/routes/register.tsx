import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { FormEvent, useState } from "react";
import { UserPlus } from "lucide-react";
import {
  ApiError,
  getGoogleLoginUrl,
  getSteamSignInUrl,
  loginUser,
  registerUser,
  setToken,
} from "@/lib/api";

export const Route = createFileRoute("/register")({ component: RegisterPage });

export function RegisterPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthProvider, setOauthProvider] = useState<"google" | "steam" | null>(null);
  const [error, setError] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      await registerUser(email, password);
      const data = await loginUser(email, password);
      setToken(data.access_token);
      await navigate({ to: "/profile" });
    } catch (reason) {
      setError(
        reason instanceof ApiError
          ? reason.message
          : "Registration failed. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function beginOAuth(provider: "google" | "steam") {
    setError("");
    setOauthProvider(provider);
    try {
      const { url } = await (provider === "google"
        ? getGoogleLoginUrl()
        : getSteamSignInUrl());
      window.location.assign(url);
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : "Could not start sign-in. Please try again.");
      setOauthProvider(null);
    }
  }

  return (
    <section className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border border-border bg-surface p-6 shadow-2xl shadow-black/20 sm:p-8">
        <Link
          to="/"
          className="text-sm font-semibold text-muted-foreground transition hover:text-foreground"
        >
          ← Back to PlayFinder
        </Link>
        <div className="mb-8">
          <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-primary">
            <UserPlus className="size-4" /> Save your discoveries
          </p>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight">
            Create your library
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Start a simple collection of games you want to remember.
          </p>
        </div>
        {error && (
          <p
            className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            role="alert"
          >
            {error}
          </p>
        )}
        <form className="space-y-4" onSubmit={onSubmit}>
          <label className="grid gap-2 text-sm font-medium">
            <span>Email</span>
            <input
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            <span>Password</span>
            <input
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={6}
            />
          </label>
          <button
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            type="submit"
            disabled={loading}
          >
            <UserPlus className="size-4" />
            {loading ? "Creating..." : "Create account"}
          </button>
        </form>
        <div className="my-6 border-t border-border pt-6">
          <p className="mb-3 text-center text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Or continue with
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <button type="button" onClick={() => beginOAuth("google")} disabled={Boolean(oauthProvider)} className="rounded-lg border border-border px-3 py-2 text-sm font-bold disabled:opacity-60">
              {oauthProvider === "google" ? "Opening Google…" : "Continue with Google"}
            </button>
            <button type="button" onClick={() => beginOAuth("steam")} disabled={Boolean(oauthProvider)} className="rounded-lg border border-border px-3 py-2 text-sm font-bold disabled:opacity-60">
              {oauthProvider === "steam" ? "Opening Steam…" : "Continue with Steam"}
            </button>
          </div>
        </div>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link
            to="/login"
            className="font-semibold text-primary hover:underline"
          >
            Sign in
          </Link>
          .
        </p>
      </div>
    </section>
  );
}
