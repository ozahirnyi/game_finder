import { Link, useNavigate } from "@tanstack/react-router";
import { type FormEvent, useEffect, useState } from "react";
import {
  ApiError,
  getGoogleLoginUrl,
  getGoogleStatus,
  getSteamSignInUrl,
  loginUser,
  registerUser,
  setToken,
} from "@/lib/api";

type AuthScreenProps = { mode: "login" | "register" };

export function AuthScreen({ mode }: AuthScreenProps) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [googleConfigured, setGoogleConfigured] = useState<boolean | null>(
    null,
  );
  const isRegister = mode === "register";

  useEffect(() => {
    getGoogleStatus()
      .then((status) => setGoogleConfigured(status.configured))
      .catch(() => setGoogleConfigured(null));
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (isRegister) await registerUser(email, password);
      const token = await loginUser(email, password);
      setToken(token.access_token);
      await navigate({ to: "/" });
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : isRegister
            ? "Registration failed. Please try again."
            : "Login failed. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function begin(provider: "google" | "steam") {
    setError("");
    try {
      const { url } =
        provider === "google"
          ? await getGoogleLoginUrl()
          : await getSteamSignInUrl();
      window.location.assign(url);
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : `Could not start ${provider === "google" ? "Google" : "Steam"} sign-in.`,
      );
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-5 py-12">
      <section className="w-full rounded-2xl border border-border bg-card p-7 shadow-xl">
        <p className="text-sm font-medium text-primary">GameFinder</p>
        <h1 className="mt-2 text-3xl font-bold">
          {isRegister ? "Create your account" : "Welcome back"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {isRegister
            ? "Save games and sync your library."
            : "Sign in to access your library."}
        </p>
        {error && (
          <p
            className="mt-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive"
            role="alert"
          >
            {error}
          </p>
        )}
        <form className="mt-6 space-y-4" onSubmit={submit}>
          <label className="grid gap-1 text-sm font-medium">
            Email
            <input
              className="rounded-md border border-input bg-background px-3 py-2"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          <label className="grid gap-1 text-sm font-medium">
            Password
            <input
              className="rounded-md border border-input bg-background px-3 py-2"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={isRegister ? 6 : undefined}
              required
            />
          </label>
          <button
            className="w-full rounded-md bg-primary px-4 py-2 font-semibold text-primary-foreground disabled:opacity-60"
            disabled={loading}
            type="submit"
          >
            {loading
              ? "Please wait..."
              : isRegister
                ? "Create account"
                : "Sign in"}
          </button>
        </form>
        <div className="my-6 border-t border-border" />
        <div className="grid gap-3">
          <button
            className="rounded-md border border-input px-4 py-2 font-semibold disabled:opacity-60"
            disabled={googleConfigured === false}
            type="button"
            onClick={() => begin("google")}
          >
            Continue with Google
          </button>
          <button
            className="rounded-md border border-input px-4 py-2 font-semibold"
            type="button"
            onClick={() => begin("steam")}
          >
            Continue with Steam
          </button>
        </div>
        {googleConfigured === false && (
          <p className="mt-3 text-sm text-muted-foreground">
            Google sign-in is not configured right now.
          </p>
        )}
        <p className="mt-6 text-sm text-muted-foreground">
          {isRegister ? "Already have an account?" : "New here?"}{" "}
          <Link
            className="font-medium text-primary underline"
            to={isRegister ? "/login" : "/register"}
          >
            {isRegister ? "Sign in" : "Create an account"}
          </Link>
        </p>
      </section>
    </main>
  );
}
