import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { FormEvent, useState } from "react";
import { UserPlus } from "lucide-react";
import { ApiError, loginUser, registerUser, setToken } from "@/lib/api";

export const Route = createFileRoute("/register")({ component: RegisterPage });

export function RegisterPage() {
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
      await registerUser(email, password);
      const data = await loginUser(email, password);
      setToken(data.access_token);
      await navigate({ to: "/profile" });
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="auth-page">
      <div className="auth-panel auth-panel--elevated">
        <div className="section-header compact">
          <p className="eyebrow auth-kicker"><UserPlus className="size-4" /> Save your discoveries</p>
          <h1>Create your library</h1>
          <p>Start a simple collection of games you want to remember.</p>
        </div>
        {error && <p className="alert error" role="alert">{error}</p>}
        <form className="form-stack" onSubmit={onSubmit}>
          <label>
            <span>Email</span>
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          <label>
            <span>Password</span>
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={6} />
          </label>
          <button type="submit" disabled={loading}>
            <UserPlus className="size-4" />
            {loading ? "Creating..." : "Create account"}
          </button>
        </form>
        <p className="muted auth-switch">Already have an account? <Link to="/login">Sign in</Link>.</p>
      </div>
    </section>
  );
}
