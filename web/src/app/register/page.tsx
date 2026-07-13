"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { ApiError, getGoogleLoginUrl, getGoogleStatus, getSteamSignInUrl, loginUser, registerUser, setToken } from "@/lib/api";

type GoogleConfiguration = "unknown" | "configured" | "unconfigured";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [googleConfiguration, setGoogleConfiguration] = useState<GoogleConfiguration>("unknown");

  useEffect(() => {
    getGoogleStatus()
      .then((status) => setGoogleConfiguration(status.configured ? "configured" : "unconfigured"))
      // A temporary API/network failure must not hide or disable an otherwise usable sign-in option.
      .catch(() => setGoogleConfiguration("unknown"));
  }, []);
  async function registerWithGoogle() {
    setError("");
    try { window.location.assign((await getGoogleLoginUrl()).url); }
    catch (err) { setError(err instanceof ApiError ? err.message : "Could not start Google sign-in."); }
  }
  async function registerWithSteam() {
    setError("");
    try { window.location.assign((await getSteamSignInUrl()).url); }
    catch (err) { setError(err instanceof ApiError ? err.message : "Could not start Steam sign-in."); }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await registerUser(email, password);
      const data = await loginUser(email, password);
      setToken(data.access_token);
      router.push("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="auth-page">
      <div className="auth-panel">
      <div className="section-header compact">
        <p className="eyebrow auth-kicker"><Icon name="user-plus" /> Save your discoveries</p>
        <h1>Create your library</h1>
        <p>Start a simple collection of games you want to remember.</p>
      </div>
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
            minLength={6}
          />
        </label>
        <button type="submit" disabled={loading}>
          <Icon name="user-plus" />
          {loading ? "Creating..." : "Create account"}
        </button>
      </form>
      <div className="auth-divider" aria-hidden="true"><span>or sign up with</span></div>
      <div className="auth-social-actions">
        <button
          className="secondary"
          type="button"
          onClick={registerWithGoogle}
          disabled={googleConfiguration === "unconfigured"}
        >
          <Icon name="sparkles" />
          Continue with Google
        </button>
        <button className="secondary" type="button" onClick={registerWithSteam}>
          <Icon name="gamepad" />
          Continue with Steam
        </button>
      </div>
      {googleConfiguration === "unconfigured" && (
        <p className="muted" role="status">Google sign-in is not configured right now.</p>
      )}
      <p className="muted">
        Already have an account? <Link href="/login">Log in</Link>.
      </p>
      </div>
    </section>
  );
}
