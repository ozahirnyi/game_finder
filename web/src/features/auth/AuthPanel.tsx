"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import {
  ApiError,
  getGoogleLoginUrl,
  getGoogleStatus,
  getSteamSignInUrl,
  loginUser,
  registerUser,
  setToken,
} from "@/lib/api";

type GoogleConfiguration = "unknown" | "configured" | "unconfigured";

type AuthPanelProps = {
  mode: "login" | "register";
  notice?: string;
};

const copy = {
  login: {
    kicker: "Your saved games",
    title: "Welcome back",
    description: "Sign in to keep building your personal game library.",
    submit: "Sign in",
    loading: "Signing in...",
    divider: "or continue with",
    prompt: "New here?",
    linkLabel: "Create an account",
    href: "/register",
    error: "Login failed. Please try again.",
    icon: "log-in" as const,
  },
  register: {
    kicker: "Save your discoveries",
    title: "Create your library",
    description: "Start a simple collection of games you want to remember.",
    submit: "Create account",
    loading: "Creating...",
    divider: "or sign up with",
    prompt: "Already have an account?",
    linkLabel: "Sign in",
    href: "/login",
    error: "Registration failed. Please try again.",
    icon: "user-plus" as const,
  },
};

export function AuthPanel({ mode, notice }: AuthPanelProps) {
  const router = useRouter();
  const content = copy[mode];
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [googleConfiguration, setGoogleConfiguration] =
    useState<GoogleConfiguration>("unknown");

  useEffect(() => {
    getGoogleStatus()
      .then((status) =>
        setGoogleConfiguration(
          status.configured ? "configured" : "unconfigured",
        ),
      )
      .catch(() => setGoogleConfiguration("unknown"));
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (mode === "register") {
        await registerUser(email, password);
      }
      const data = await loginUser(email, password);
      setToken(data.access_token);
      router.push("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : content.error);
    } finally {
      setLoading(false);
    }
  }

  async function beginGoogleSignIn() {
    setError("");
    try {
      window.location.assign((await getGoogleLoginUrl()).url);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Could not start Google sign-in.",
      );
    }
  }

  async function beginSteamSignIn() {
    setError("");
    try {
      window.location.assign((await getSteamSignInUrl()).url);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Could not start Steam sign-in.",
      );
    }
  }

  return (
    <section className="auth-page">
      <div className="auth-panel auth-panel--elevated">
        <div className="section-header compact">
          <p className="eyebrow auth-kicker">
            <Icon name={content.icon} /> {content.kicker}
          </p>
          <h1>{content.title}</h1>
          <p>{content.description}</p>
        </div>
        {notice && (
          <p className="alert" role="status">
            {notice}
          </p>
        )}
        {error && (
          <p className="alert error" role="alert">
            {error}
          </p>
        )}
        <form className="form-stack" onSubmit={onSubmit}>
          <label>
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          <label>
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={mode === "register" ? 6 : undefined}
            />
          </label>
          <button type="submit" disabled={loading}>
            <Icon name={content.icon} />
            {loading ? content.loading : content.submit}
          </button>
        </form>
        <div className="auth-divider" aria-hidden="true">
          <span>{content.divider}</span>
        </div>
        <div className="auth-social-actions">
          <button
            className="secondary"
            type="button"
            onClick={beginGoogleSignIn}
            disabled={googleConfiguration === "unconfigured"}
          >
            <Icon name="sparkles" />
            Continue with Google
          </button>
          <button
            className="secondary"
            type="button"
            onClick={beginSteamSignIn}
          >
            <Icon name="gamepad" />
            Continue with Steam
          </button>
        </div>
        {googleConfiguration === "unconfigured" && (
          <p className="muted" role="status">
            Google sign-in is not configured right now.
          </p>
        )}
        <p className="muted auth-switch">
          {content.prompt} <Link href={content.href}>{content.linkLabel}</Link>.
        </p>
      </div>
    </section>
  );
}
