"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { exchangeGoogleCode, exchangeSteamCode, setToken } from "@/lib/api";

function OAuthCallback() {
  const router = useRouter();
  const params = useSearchParams();
  const provider = params.get("provider");
  const [message, setMessage] = useState("Completing sign-in...");
  const code = params.get("exchange_code");
  const invalid = (provider !== "google" && provider !== "steam") || !code;

  useEffect(() => {
    if (invalid || !code) return;
    const exchange =
      provider === "steam" ? exchangeSteamCode : exchangeGoogleCode;
    exchange(code)
      .then((data) => {
        setToken(data.access_token);
        router.replace("/profile");
      })
      .catch(() => setMessage("Sign-in expired. Please try again."));
  }, [code, invalid, provider, router]);

  const providerName = provider === "steam" ? "Steam" : "Google";
  const displayMessage = invalid
    ? "Sign-in was cancelled or expired."
    : message;
  return (
    <section className="auth-page">
      <div className="auth-panel auth-panel--elevated auth-callback">
        <p className="eyebrow">Secure handoff</p>
        <h1>{providerName} sign-in</h1>
        <p role="status">{displayMessage}</p>
        {!displayMessage.startsWith("Completing") && (
          <Link className="button secondary" href="/login">
            Back to sign in
          </Link>
        )}
      </div>
    </section>
  );
}

export default function OAuthCallbackPage() {
  return (
    <Suspense fallback={null}>
      <OAuthCallback />
    </Suspense>
  );
}
