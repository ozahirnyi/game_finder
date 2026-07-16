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
    <section className="auth-page">
      <div className="auth-panel auth-panel--elevated">
        <div className="section-header compact">
          <p className="eyebrow auth-kicker"><LogIn className="size-4" /> Your saved games</p>
          <h1>Welcome back</h1>
          <p>Sign in to keep building your personal game library.</p>
        </div>
        {error && <p className="alert error" role="alert">{error}</p>}
        <form className="form-stack" onSubmit={onSubmit}>
          <label>
            <span>Email</span>
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          <label>
            <span>Password</span>
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
          </label>
          <button type="submit" disabled={loading}>
            <LogIn className="size-4" />
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
        <p className="muted auth-switch">New here? <Link to="/register">Create an account</Link>.</p>
      </div>
    </section>
  );
}
