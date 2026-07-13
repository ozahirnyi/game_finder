"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { ApiError, getGoogleLoginUrl, getGoogleStatus, getSteamSignInUrl, loginUser, setToken } from "@/lib/api";

type GoogleConfiguration = "unknown" | "configured" | "unconfigured";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [googleConfiguration, setGoogleConfiguration] = useState<GoogleConfiguration>("unknown");
  const notice = searchParams.get("message") ?? "";
  const nextPath = searchParams.get("next");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await loginUser(email, password);
      setToken(data.access_token);
      router.push(nextPath?.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    getGoogleStatus()
      .then((status) => setGoogleConfiguration(status.configured ? "configured" : "unconfigured"))
      // A temporary API/network failure must not hide or disable an otherwise usable sign-in option.
      .catch(() => setGoogleConfiguration("unknown"));
  }, []);
  async function loginWithGoogle() {
    setError("");
    try { window.location.assign((await getGoogleLoginUrl()).url); }
    catch (err) { setError(err instanceof ApiError ? err.message : "Could not start Google sign-in."); }
  }
  async function loginWithSteam() {
    setError("");
    try { window.location.assign((await getSteamSignInUrl()).url); }
    catch (err) { setError(err instanceof ApiError ? err.message : "Could not start Steam sign-in."); }
  }

  return (
    <section className="auth-page">
      <div className="auth-panel">
        <div className="section-header compact">
          <p className="eyebrow auth-kicker"><Icon name="log-in" /> Your saved games</p>
          <h1>Welcome back</h1>
          <p>Log in to keep building your personal game library.</p>
        </div>
        {notice && <p className="alert">{notice}</p>}
        {error && <p className="alert error">{error}</p>}
        <form className="form-stack" onSubmit={onSubmit}>
          <label>
            <span>Email</span>
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          <label>
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          <button type="submit" disabled={loading}>
            <Icon name="log-in" />
            {loading ? "Logging in..." : "Log in"}
          </button>
        </form>
        <div className="auth-divider" aria-hidden="true"><span>or continue with</span></div>
        <div className="auth-social-actions">
          <button
            className="secondary"
            type="button"
            onClick={loginWithGoogle}
            disabled={googleConfiguration === "unconfigured"}
          >
            <Icon name="sparkles" />
            Continue with Google
          </button>
          <button className="secondary" type="button" onClick={loginWithSteam}>
            <Icon name="gamepad" />
            Continue with Steam
          </button>
        </div>
        {googleConfiguration === "unconfigured" && (
          <p className="muted" role="status">Google sign-in is not configured right now.</p>
        )}
        <p className="muted">
          New here? <Link href="/register">Create an account</Link>.
        </p>
      </div>
    </section>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
