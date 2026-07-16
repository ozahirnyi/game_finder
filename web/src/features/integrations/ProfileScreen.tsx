"use client";

import { useEffect, useState } from "react";
import type { GoogleStatus, TelegramAccount, UserRead } from "@/lib/api";
import { getCurrentUser, getGoogleStatus, getTelegramAccount, getTelegramLinkUrl, isAuthenticated, sendTelegramTestAlert, unlinkTelegramAccount } from "@/lib/api";
import { Button, Panel, Section, StatePanel } from "@/components/ui";

export function ProfileScreen() {
  const authenticated = isAuthenticated();
  const [user, setUser] = useState<UserRead | null>(null);
  const [google, setGoogle] = useState<GoogleStatus | null>(null);
  const [telegram, setTelegram] = useState<TelegramAccount | null>(null);
  const [loading, setLoading] = useState(authenticated);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    if (!authenticated) return;
    Promise.all([getCurrentUser(), getGoogleStatus(), getTelegramAccount()])
      .then(([profile, googleStatus, telegramAccount]) => { setUser(profile); setGoogle(googleStatus); setTelegram(telegramAccount); })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Could not load your profile."))
      .finally(() => setLoading(false));
  }, [authenticated]);
  async function connectTelegram() {
    setBusy(true); setError("");
    try { const link = await getTelegramLinkUrl(); if (!link.configured || !link.url) throw new Error(link.message ?? "Telegram is not configured."); window.open(link.url, "_blank", "noopener,noreferrer"); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not connect Telegram."); }
    finally { setBusy(false); }
  }
  async function telegramAction(action: "test" | "unlink") {
    setBusy(true); setError("");
    try { if (action === "test") { await sendTelegramTestAlert(); setMessage("Test alert sent to Telegram."); } else { setTelegram(await unlinkTelegramAccount()); setMessage("Telegram disconnected."); } }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Telegram action failed."); }
    finally { setBusy(false); }
  }
  if (!authenticated) return <StatePanel kind="unauthenticated" title="Sign in to see your profile" />;
  if (loading) return <StatePanel kind="loading" title="Loading your profile" />;
  if (error) return <StatePanel kind="error" title="Profile is unavailable" detail={error} />;
  return <div className="stack"><header className="section-header"><p className="eyebrow">Profile</p><h1>{user?.email ?? "Your account"}</h1></header>{message ? <p className="alert success">{message}</p> : null}
    <Section title="Google" detail={google?.configured ? (user?.google_linked ? "Google is linked." : "Google sign-in is available.") : "Google sign-in is not configured."}><Panel><p>{user?.google_linked ? "Linked" : "Not linked"}</p></Panel></Section>
    <Section title="Telegram alerts" detail={telegram?.linked ? `Connected${telegram.username ? ` as @${telegram.username}` : ""}.` : "Connect Telegram for alerts."}><Panel><div className="actions">{telegram?.linked ? <><Button variant="secondary" disabled={busy} onClick={() => telegramAction("test")}>Send test</Button><Button variant="secondary" disabled={busy} onClick={() => telegramAction("unlink")}>Disconnect</Button></> : <Button disabled={busy} onClick={connectTelegram}>Connect Telegram</Button>}</div></Panel></Section>
  </div>;
}
