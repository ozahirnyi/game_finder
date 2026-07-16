import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Avatar, GameCover } from "@/components/GameCover";
import { Chip, SectionHeader } from "@/components/ui-bits";
import { getCurrentUser, getGoogleLinkUrl, getGoogleStatus, getTelegramAccount, getTelegramLinkUrl, sendTelegramTestAlert, unlinkTelegramAccount, type GoogleStatus, type TelegramAccount, type UserRead } from "@/lib/api";
import { Check, Edit3 } from "lucide-react";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Profile — GameFinder" },
      { name: "description", content: "Your GameFinder profile: stats, favorite games, integrations, and privacy controls." },
    ],
  }),
  component: ProfilePage,
});

export function ProfilePage() {
  const [user, setUser] = useState<UserRead | null>(null);
  const [profileError, setProfileError] = useState("");
  const [profileUnauthorized, setProfileUnauthorized] = useState(false);
  const [google, setGoogle] = useState<GoogleStatus | null>(null);
  const [telegram, setTelegram] = useState<TelegramAccount | null>(null);
  const [googleError, setGoogleError] = useState("");
  const [googleRetry, setGoogleRetry] = useState<"status" | "link" | "">("");
  const [telegramError, setTelegramError] = useState("");
  const [telegramRetry, setTelegramRetry] = useState<"status" | "link" | "">("");
  const [busy, setBusy] = useState("");

  function message(reason: unknown) {
    return reason instanceof Error ? reason.message : "Data unavailable";
  }
  async function loadProfile() { try { setProfileError(""); setProfileUnauthorized(false); setUser(await getCurrentUser()); } catch (reason) { setUser(null); setProfileError(message(reason)); setProfileUnauthorized(typeof reason === "object" && reason !== null && "status" in reason && reason.status === 401); } }
  async function loadGoogle() { try { setGoogleError(""); setGoogleRetry(""); setGoogle(await getGoogleStatus()); } catch (reason) { setGoogleError(message(reason)); setGoogleRetry("status"); } }
  async function loadTelegram() { try { setTelegramError(""); setTelegramRetry(""); setTelegram(await getTelegramAccount()); } catch (reason) { setTelegramError(message(reason)); setTelegramRetry("status"); } }
  useEffect(() => { void loadProfile(); void loadGoogle(); void loadTelegram(); }, []);
  async function connectGoogle() {
    setBusy("google"); setGoogleError("");
    try { const result = await getGoogleLinkUrl(); window.location.assign(result.url); } catch (reason) { setGoogleError(message(reason)); setGoogleRetry("link"); } finally { setBusy(""); }
  }
  async function connectTelegram() {
    setBusy("telegram"); setTelegramError("");
    try { const result = await getTelegramLinkUrl(); if (!result.configured || !result.url) throw new Error(result.message ?? "Telegram is not configured."); window.open(result.url, "_blank", "noopener,noreferrer"); } catch (reason) { setTelegramError(message(reason)); setTelegramRetry("link"); } finally { setBusy(""); }
  }
  async function telegramAction(action: "test" | "unlink") {
    setBusy("telegram"); setTelegramError("");
    try { if (action === "test") await sendTelegramTestAlert(); else setTelegram(await unlinkTelegramAccount()); } catch (reason) { setTelegramError(message(reason)); } finally { setBusy(""); }
  }
  const currentUser = { avatarFrom: "#22c55e", avatarTo: "#0f766e", name: user?.email ?? "Data unavailable", handle: user?.id ?? "unavailable", bio: "Data unavailable", favoriteGenres: ["Data unavailable"], platforms: ["Data unavailable"], integrations: { steam: false, psn: false, telegram: telegram?.linked ?? false, google: user?.google_linked ?? false } };
  const favs: never[] = [];
  const wl: never[] = [];

  return (
    <AppShell>
      {/* Cover / header */}
      <div className="relative mb-10 overflow-hidden rounded-3xl border border-border">
        <div
          className="h-40"
          style={{
            background: `radial-gradient(60% 100% at 30% 0%, ${currentUser.avatarFrom}55 0%, transparent 60%), linear-gradient(135deg, ${currentUser.avatarTo} 0%, hsl(240 10% 3.5%) 100%)`,
          }}
        />
        <div className="flex flex-col items-start gap-4 px-6 pb-6 sm:flex-row sm:items-end sm:gap-6">
          <Avatar
            from={currentUser.avatarFrom}
            to={currentUser.avatarTo}
            name={currentUser.name}
            className="-mt-12 size-24 shrink-0 rounded-2xl ring-4 ring-background"
          />
          <div className="min-w-0 flex-1 pt-2">
            <h1 className="text-3xl font-extrabold tracking-tight">
              {currentUser.name}
            </h1>
            <p className="font-mono text-xs text-muted-foreground">
              @{currentUser.handle}
            </p>
            <p className="mt-2 max-w-lg text-sm text-muted-foreground">
              {profileUnauthorized ? <><span>{profileError} </span><Link to="/login" className="font-semibold text-primary hover:underline">Sign in</Link>.</> : profileError || currentUser.bio}
            </p>
          </div>
          <button onClick={profileError ? loadProfile : undefined} className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-bold hover:bg-white/5">
            <Edit3 className="size-3.5" /> {profileError ? "Retry profile" : "Edit profile"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { l: "Library", v: "Data unavailable" },
          { l: "Friends", v: "Data unavailable" },
          { l: "Shared games", v: "Data unavailable" },
          { l: "Playtime", v: "Data unavailable" },
        ].map((s) => (
          <div
            key={s.l}
            className="rounded-2xl border border-border bg-surface p-5"
          >
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              {s.l}
            </p>
            <p className="mt-1 text-3xl font-black">{s.v}</p>
          </div>
        ))}
      </div>

      <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-12">
        <div className="space-y-10 lg:col-span-8">
          <div>
            <SectionHeader title="Preferences" />
            <div className="rounded-2xl border border-border bg-surface p-6">
              <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Favorite genres
              </p>
              <div className="mb-6 flex flex-wrap gap-2">
                {currentUser.favoriteGenres.map((g) => (
                  <Chip key={g} tone="primary">
                    {g}
                  </Chip>
                ))}
              </div>
              <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Platforms
              </p>
              <div className="flex flex-wrap gap-2">
                {currentUser.platforms.map((p) => (
                  <Chip key={p} tone="outline">
                    {p}
                  </Chip>
                ))}
              </div>
            </div>
          </div>

          <div>
            <SectionHeader title="Favorite games" />
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {(favs.length ? favs : [{ id: "unavailable", title: "Data unavailable", coverFrom: "#27272a", coverTo: "#18181b", playtime: null }]).map((g) => (
                <div
                  key={g.id}
                  className="overflow-hidden rounded-xl border border-border bg-surface"
                >
                  <GameCover
                    from={g.coverFrom}
                    to={g.coverTo}
                    title={g.title}
                    className="aspect-[3/4] w-full"
                  />
                  <div className="p-3">
                    <p className="truncate text-sm font-bold">{g.title}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {g.playtime ?? "—"}h played
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <SectionHeader title="Active wishlist" />
            <div className="space-y-3">
              {(wl.length ? wl : [{ id: "unavailable", title: "Data unavailable", coverFrom: "#27272a", coverTo: "#18181b", genres: ["Data unavailable"], price: "—" }]).map((g) => (
                <div
                  key={g.id}
                  className="flex items-center gap-4 rounded-xl border border-border bg-surface p-3"
                >
                  <GameCover
                    from={g.coverFrom}
                    to={g.coverTo}
                    title={g.title}
                    compact
                    className="size-14 rounded-md"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{g.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {g.genres.join(" · ")}
                    </p>
                  </div>
                  <p className="font-mono text-sm font-bold text-primary">
                    ${g.price}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-8 lg:col-span-4">
          <div className="rounded-2xl border border-border bg-surface p-6">
            <SectionHeader title="Integrations" />
            {[
              { name: "Steam", connected: currentUser.integrations.steam, note: "Data unavailable" },
              { name: "PlayStation Network", connected: currentUser.integrations.psn, note: "Data unavailable" },
              { name: "Telegram", connected: currentUser.integrations.telegram, note: "Price-drop alerts" },
              { name: "Google", connected: currentUser.integrations.google, note: "Sign-in" },
            ].map((i) => (

              <div
                key={i.name}
                className="flex items-center justify-between border-t border-border py-3 first:border-t-0"
              >
                <div>
                  <p className="text-sm font-bold">{i.name}</p>
                  <p className="text-xs text-muted-foreground">{i.name === "Steam" || i.name === "PlayStation Network" ? "Data unavailable" : i.name === "Google" ? googleError || (google?.configured ? i.note : "Google is not configured") : telegramError || i.note}</p>
                </div>
                {i.connected ? (
                  <Chip tone="primary">
                    <Check className="mr-1 size-3" /> Connected
                  </Chip>
                ) : (
                  <button disabled={busy === "google" || busy === "telegram"} onClick={i.name === "Google" ? (googleRetry === "link" ? connectGoogle : googleError ? loadGoogle : connectGoogle) : i.name === "Telegram" ? (telegramRetry === "link" ? connectTelegram : telegramError ? loadTelegram : connectTelegram) : undefined} className="rounded-md bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground">
                    {i.name === "Google" && googleError ? "Retry Google" : i.name === "Telegram" && telegramError ? "Retry Telegram" : "Connect"}
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-border bg-surface p-6">
            <SectionHeader title="Privacy" />
            {[
              { l: "Library visible to friends", v: true },
              { l: "Wishlist visible to friends", v: true },
              { l: "Activity feed", v: true },
              { l: "Allow friend requests", v: false },
            ].map((p) => (
              <label
                key={p.l}
                className="flex cursor-pointer items-center justify-between border-t border-border py-3 first:border-t-0"
              >
                <span className="text-sm">{p.l}</span>
                <span
                  className={`grid h-6 w-11 place-items-start rounded-full p-0.5 transition ${
                    p.v ? "bg-primary" : "bg-muted"
                  } ${p.v ? "justify-items-end" : "justify-items-start"}`}
                >
                  <span className="size-5 rounded-full bg-background" />
                </span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
