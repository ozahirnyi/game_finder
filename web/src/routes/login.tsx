import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { FormEvent, useState } from "react";
import { LogIn } from "lucide-react";
import { ApiError, loginUser, setToken } from "@/lib/api";

export const Route = createFileRoute("/login")({ component: LoginPage });

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const data = await loginUser(email, password);
      setToken(data.access_token);
      await navigate({ to: "/profile" });
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border border-border bg-surface p-6 shadow-2xl shadow-black/20 sm:p-8">
        <div className="mb-8">
          <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-primary"><LogIn className="size-4" /> Your saved games</p>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight">Welcome back</h1>
          <p className="mt-2 text-sm text-muted-foreground">Sign in to keep building your personal game library.</p>
        </div>
        {error && <p className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">{error}</p>}
        <form className="space-y-4" onSubmit={onSubmit}>
          <label className="grid gap-2 text-sm font-medium">
            <span>Email</span>
            <input className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            <span>Password</span>
            <input className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
          </label>
          <button className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60" type="submit" disabled={loading}>
            <LogIn className="size-4" />
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-muted-foreground">New here? <Link to="/register" className="font-semibold text-primary hover:underline">Create an account</Link>.</p>
      </div>
    </section>
  );
}
