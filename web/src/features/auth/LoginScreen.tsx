import { type FormEvent, useEffect, useState } from "react";
import {
  ApiError,
  getGoogleLoginUrl,
  getGoogleStatus,
  getSteamSignInUrl,
  loginUser,
  setToken,
} from "@/lib/api";
import {
  rememberOAuthReturnTo,
  validateInternalReturnTo,
} from "./auth-navigation";

type LoginScreenProps = {
  returnTo: string;
  navigate: (target: string) => void;
  navigateExternal: (target: string) => void;
};

function errorMessage(reason: unknown, fallback: string) {
  return reason instanceof ApiError ? reason.message : fallback;
}

export function LoginScreen({
  returnTo,
  navigate,
  navigateExternal,
}: LoginScreenProps) {
  const safeReturnTo = validateInternalReturnTo(returnTo) ?? "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [googleConfigured, setGoogleConfigured] = useState<boolean | null>(
    null,
  );

  useEffect(() => {
    let active = true;
    getGoogleStatus()
      .then((status) => {
        if (active) setGoogleConfigured(status.configured);
      })
      .catch(() => {
        if (active) setGoogleConfigured(null);
      });
    return () => {
      active = false;
    };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await loginUser(email, password);
      setToken(response.access_token);
      navigate(safeReturnTo);
    } catch (reason) {
      setError(errorMessage(reason, "Login failed. Please try again."));
    } finally {
      setLoading(false);
    }
  }

  async function beginOAuth(provider: "google" | "steam") {
    setError("");
    try {
      const response =
        provider === "google"
          ? await getGoogleLoginUrl()
          : await getSteamSignInUrl();
      rememberOAuthReturnTo(safeReturnTo);
      navigateExternal(response.url);
    } catch (reason) {
      setError(
        errorMessage(
          reason,
          `Could not start ${provider === "google" ? "Google" : "Steam"} sign-in.`,
        ),
      );
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-background px-5 py-10 text-foreground">
      <section className="w-full max-w-md rounded-3xl border border-border bg-surface p-7">
        <p className="font-mono text-xs uppercase tracking-widest text-primary">
          Your PlayFinder account
        </p>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight">
          Welcome back
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sign in to continue where you left off.
        </p>

        {error ? (
          <p
            className="mt-5 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        <form
          className="mt-6 space-y-4"
          onSubmit={(event) => void submit(event)}
        >
          <label className="block text-sm font-bold">
            Email
            <input
              className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 font-normal outline-none focus:border-primary"
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
          </label>
          <label className="block text-sm font-bold">
            Password
            <input
              className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 font-normal outline-none focus:border-primary"
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </label>
          <button
            className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50"
            disabled={loading}
            type="submit"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          or continue with
          <span className="h-px flex-1 bg-border" />
        </div>

        <div className="grid gap-3">
          <button
            className="rounded-lg border border-border bg-secondary px-4 py-2 text-sm font-bold disabled:opacity-50"
            disabled={googleConfigured === false}
            onClick={() => void beginOAuth("google")}
            type="button"
          >
            Continue with Google
          </button>
          <button
            className="rounded-lg border border-border bg-secondary px-4 py-2 text-sm font-bold"
            onClick={() => void beginOAuth("steam")}
            type="button"
          >
            Continue with Steam
          </button>
        </div>

        {googleConfigured === false ? (
          <p className="mt-3 text-sm text-muted-foreground" role="status">
            Google sign-in is not configured right now.
          </p>
        ) : null}
      </section>
    </main>
  );
}
