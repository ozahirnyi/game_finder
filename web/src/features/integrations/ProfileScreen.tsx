"use client";

import { useEffect, useState } from "react";
import type { FavoriteItem, GoogleStatus, ProfileSettings, TelegramAccount, UserRead } from "@/lib/api";
import {
  getCurrentUser,
  getGoogleStatus,
  getProfileSettings,
  getTelegramAccount,
  getTelegramLinkUrl,
  isAuthenticated,
  listFavorites,
  sendTelegramTestAlert,
  unlinkTelegramAccount,
  updateProfileSettings,
} from "@/lib/api";
import { Button, Panel, Section, StatePanel } from "@/components/ui";

function failureMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function ProfileScreen() {
  const authenticated = isAuthenticated();
  const [user, setUser] = useState<UserRead | null>(null);
  const [google, setGoogle] = useState<GoogleStatus | null>(null);
  const [telegram, setTelegram] = useState<TelegramAccount | null>(null);
  const [loading, setLoading] = useState(authenticated);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [googleError, setGoogleError] = useState("");
  const [telegramError, setTelegramError] = useState("");
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [privacy, setPrivacy] = useState<ProfileSettings | null>(null);

  async function loadGoogle() {
    try {
      setGoogle(await getGoogleStatus());
    } catch (reason) {
      setGoogleError(failureMessage(reason, "Could not load Google status."));
    }
  }

  async function loadTelegram() {
    try {
      setTelegram(await getTelegramAccount());
    } catch (reason) {
      setTelegramError(
        failureMessage(reason, "Could not load Telegram alerts."),
      );
    }
  }

  useEffect(() => {
    if (!authenticated) return;
    getCurrentUser()
      .then(setUser)
      .catch((reason: unknown) =>
        setError(failureMessage(reason, "Could not load your profile.")),
      )
      .finally(() => setLoading(false));
    void getGoogleStatus()
      .then(setGoogle)
      .catch((reason: unknown) =>
        setGoogleError(failureMessage(reason, "Could not load Google status.")),
      );
    void getTelegramAccount()
      .then(setTelegram)
      .catch((reason: unknown) =>
        setTelegramError(
          failureMessage(reason, "Could not load Telegram alerts."),
        ),
      );
    void listFavorites().then(setFavorites).catch(() => undefined);
    void getProfileSettings().then(setPrivacy).catch(() => undefined);
  }, [authenticated]);
  async function savePrivacy() {
    if (!privacy) return;
    try { setPrivacy(await updateProfileSettings({ library_visibility: privacy.library_visibility, favorites_visibility: privacy.favorites_visibility, wishlist_visibility: privacy.wishlist_visibility, steam_visibility: privacy.steam_visibility })); }
    catch (reason) { setError(failureMessage(reason, "Could not save privacy.")); }
  }
  async function connectTelegram() {
    setBusy(true);
    setTelegramError("");
    try {
      const link = await getTelegramLinkUrl();
      if (!link.configured || !link.url)
        throw new Error(link.message ?? "Telegram is not configured.");
      window.open(link.url, "_blank", "noopener,noreferrer");
    } catch (reason) {
      setTelegramError(failureMessage(reason, "Could not connect Telegram."));
    } finally {
      setBusy(false);
    }
  }
  async function telegramAction(action: "test" | "unlink") {
    setBusy(true);
    setTelegramError("");
    try {
      if (action === "test") {
        await sendTelegramTestAlert();
        setMessage("Test alert sent to Telegram.");
      } else {
        setTelegram(await unlinkTelegramAccount());
        setMessage("Telegram disconnected.");
      }
    } catch (reason) {
      setTelegramError(failureMessage(reason, "Telegram action failed."));
    } finally {
      setBusy(false);
    }
  }
  if (!authenticated)
    return (
      <StatePanel kind="unauthenticated" title="Sign in to see your profile" />
    );
  if (loading)
    return <StatePanel kind="loading" title="Loading your profile" />;
  if (error)
    return (
      <StatePanel kind="error" title="Profile is unavailable" detail={error} />
    );
  return (
    <div className="stack">
      <header className="section-header">
        <p className="eyebrow">Profile</p>
        <h1>{user?.email ?? "Your account"}</h1>
      </header>
      {message ? <p className="alert success">{message}</p> : null}
      <Section title="Favorites" detail="Games you like and that represent your taste.">
        <Panel>{favorites.length ? favorites.map((favorite) => <p key={favorite.id}>{favorite.title}</p>) : <p>No favorites yet.</p>}</Panel>
      </Section>
      <Section title="Privacy" detail="Choose who can see each part of your profile.">
        <Panel>{privacy ? <><p><a href={`/users/${privacy.profile_id}`}>View public profile</a></p>{(["library_visibility", "favorites_visibility", "wishlist_visibility", "steam_visibility"] as const).map((name) => <label key={name}>{name.replace("_visibility", "")} <select value={privacy[name]} onChange={(event) => setPrivacy({ ...privacy, [name]: event.target.value as ProfileSettings[typeof name] })}><option value="public">Public</option><option value="friends">Friends</option><option value="private">Only me</option></select></label>)}<Button onClick={savePrivacy}>Save privacy</Button></> : <p>Loading privacy settings…</p>}</Panel>
      </Section>
      <Section
        title="Google"
        detail={
          google?.configured
            ? user?.google_linked
              ? "Google is linked."
              : "Google sign-in is available."
            : "Google sign-in is not configured."
        }
      >
        {googleError ? (
          <StatePanel
            kind="error"
            title="Google is unavailable"
            detail={googleError}
            action={{
              label: "Retry Google",
              onClick: () => {
                setGoogleError("");
                void loadGoogle();
              },
            }}
          />
        ) : (
          <Panel>
            <p>{user?.google_linked ? "Linked" : "Not linked"}</p>
          </Panel>
        )}
      </Section>
      <Section
        title="Telegram alerts"
        detail={
          telegram?.linked
            ? `Connected${telegram.username ? ` as @${telegram.username}` : ""}.`
            : "Connect Telegram for alerts."
        }
      >
        {telegramError ? (
          <StatePanel
            kind="error"
            title="Telegram alerts are unavailable"
            detail={telegramError}
            action={{
              label: "Retry Telegram",
              onClick: () => {
                setTelegramError("");
                void loadTelegram();
              },
            }}
          />
        ) : (
          <Panel>
            <div className="actions">
              {telegram?.linked ? (
                <>
                  <Button
                    variant="secondary"
                    disabled={busy}
                    onClick={() => telegramAction("test")}
                  >
                    Send test
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={busy}
                    onClick={() => telegramAction("unlink")}
                  >
                    Disconnect
                  </Button>
                </>
              ) : (
                <Button disabled={busy} onClick={connectTelegram}>
                  Connect Telegram
                </Button>
              )}
            </div>
          </Panel>
        )}
      </Section>
    </div>
  );
}
