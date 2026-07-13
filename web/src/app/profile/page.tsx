"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ApiError,
  PsnImportPreview,
  ProfileSettings,
  SavedGame,
  SearchGame,
  SteamAccount,
  TelegramAccount,
  clearToken,
  confirmPsnImport,
  getProfileSettings,
  getSteamAccount,
  getTelegramAccount,
  getTelegramLinkUrl,
  isAuthenticated,
  listSavedGames,
  previewPsnImport,
  searchGames,
  sendTelegramTestAlert,
  updateProfileSettings,
  unlinkTelegramAccount,
} from "@/lib/api";

async function loadSavedGameImages(savedGames: SavedGame[], limit: number) {
  const entries = await Promise.all(
    savedGames.slice(0, limit).map(async (game) => {
      try {
        const result = await searchGames(game.title);
        return [game.id, result.results[0] ?? null] as const;
      } catch {
        return [game.id, null] as const;
      }
    })
  );
  return Object.fromEntries(entries) as Record<string, SearchGame | null>;
}

export default function ProfilePage() {
  const router = useRouter();
  const [telegram, setTelegram] = useState<TelegramAccount | null>(null);
  const [steam, setSteam] = useState<SteamAccount | null>(null);
  const [settings, setSettings] = useState<ProfileSettings | null>(null);
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [savedGames, setSavedGames] = useState<SavedGame[]>([]);
  const [imageMap, setImageMap] = useState<Record<string, SearchGame | null>>({});
  const [loading, setLoading] = useState(true);
  const [telegramBusy, setTelegramBusy] = useState(false);
  const [psnBusy, setPsnBusy] = useState(false);
  const [psnPreview, setPsnPreview] = useState<PsnImportPreview | null>(null);
  const [openProfileSection, setOpenProfileSection] = useState<"psn" | "telegram" | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push("/login?message=Log in to open your profile.");
      return;
    }

    let active = true;

    async function loadProfile() {
      setLoading(true);
      setError("");
      try {
        const [telegramData, savedData, steamData, settingsData] = await Promise.all([
          getTelegramAccount().catch(() => null),
          listSavedGames().catch(() => []),
          getSteamAccount().catch(() => null),
          getProfileSettings().catch(() => null),
        ]);
        if (active) {
          setTelegram(telegramData);
          setSteam(steamData);
          setSettings(settingsData);
          setSavedGames(savedData);
          loadSavedGameImages(savedData, 6).then((images) => {
            if (active) {
              setImageMap(images);
            }
          });
        }
      } catch (err) {
        if (active) {
          if (err instanceof ApiError && err.status === 401) {
            router.push("/login?message=Your session expired. Please log in again.");
            return;
          }
          setError(err instanceof ApiError ? err.message : "Could not load your profile.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadProfile();

    return () => {
      active = false;
    };
  }, [router]);

  function logout() {
    clearToken();
    router.push("/login?message=You have logged out.");
  }

  async function connectTelegram() {
    setTelegramBusy(true);
    setError("");
    setMessage("");
    try {
      const link = await getTelegramLinkUrl();
      if (!link.configured || !link.url) {
        setError(link.message || "Telegram bot is not configured yet.");
        return;
      }
      window.open(link.url, "_blank", "noopener,noreferrer");
      setMessage("Telegram opened. Press Start in the bot, then refresh this profile.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create Telegram link.");
    } finally {
      setTelegramBusy(false);
    }
  }

  async function sendTelegramTest() {
    setTelegramBusy(true);
    setError("");
    setMessage("");
    try {
      await sendTelegramTestAlert();
      setMessage("Test alert sent to Telegram.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not send Telegram test alert.");
    } finally {
      setTelegramBusy(false);
    }
  }

  async function disconnectTelegram() {
    setTelegramBusy(true);
    setError("");
    setMessage("");
    try {
      const updated = await unlinkTelegramAccount();
      setTelegram(updated);
      setMessage("Telegram disconnected.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not disconnect Telegram.");
    } finally {
      setTelegramBusy(false);
    }
  }

  async function previewPsnFile(file: File | undefined) {
    if (!file) return;
    setPsnBusy(true);
    setError("");
    setMessage("");
    setPsnPreview(null);
    try {
      const preview = await previewPsnImport(file);
      setPsnPreview(preview);
      setMessage(`${preview.total} PlayStation games found. Review them before importing.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not read the PlayStation export.");
    } finally {
      setPsnBusy(false);
    }
  }

  async function importPsnGames() {
    if (!psnPreview?.games.length) return;
    setPsnBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await confirmPsnImport(psnPreview.games);
      const updatedGames = await listSavedGames();
      setSavedGames(updatedGames);
      loadSavedGameImages(updatedGames, 6).then(setImageMap);
      setPsnPreview(null);
      setMessage(`PlayStation import complete: ${result.created} added, ${result.updated} updated, ${result.skipped} already in your library.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not import PlayStation games.");
    } finally {
      setPsnBusy(false);
    }
  }

  async function saveSocialSettings(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!settings) return;
    setSettingsBusy(true); setError(""); setMessage("");
    try { setSettings(await updateProfileSettings(settings)); setMessage("Social profile settings saved."); }
    catch (err) { setError(err instanceof ApiError ? err.message : "Could not save social profile settings."); }
    finally { setSettingsBusy(false); }
  }

  if (loading) {
    return <p className="alert">Loading your profile...</p>;
  }

  return (
    <section className="stack">
      <div className="page-heading-row">
        <div className="profile-heading">
          <div className="section-header compact">
            <p className="eyebrow">Profile</p>
            <h1>Your space</h1>
            <p>Your account, saved games, and alerts in one place.</p>
          </div>
          <div className="profile-status-row">
            <span className="profile-account-status">
              <span>Account</span>
              Signed in
            </span>
            <Link className="profile-steam-status" href="/steam">
              Steam · {steam?.linked ? "Connected" : "Not connected"} <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
        <button className="secondary fit" type="button" onClick={logout}>
          Log out
        </button>
      </div>

      {error && <p className="alert error">{error}</p>}
      {message && <p className="alert success">{message}</p>}

      <section className="profile-dashboard">
        <section className="results-panel profile-section">
          <div className="results-heading"><div><p className="eyebrow">Social profile</p><h2>Share on your terms</h2></div>{settings?.nickname && <Link className="muted-link" href={`/u/${encodeURIComponent(settings.nickname)}`}>View public profile</Link>}</div>
          <form className="stack" onSubmit={saveSocialSettings}>
            <label>Public nickname<input value={settings?.nickname ?? ""} minLength={3} maxLength={32} onChange={(event) => setSettings((current) => current ? { ...current, nickname: event.target.value || null } : current)} placeholder="Choose a unique nickname" /></label>
            <p className="muted">Your email is never shown on your public profile.</p>
            <label>Platforms visibility<select value={settings?.platforms_visibility ?? "everyone"} onChange={(event) => setSettings((current) => current ? { ...current, platforms_visibility: event.target.value as ProfileSettings["platforms_visibility"] } : current)}><option value="everyone">Everyone</option><option value="friends">Friends only</option><option value="nobody">Nobody</option></select></label>
            <label>Current game visibility<select value={settings?.current_game_visibility ?? "everyone"} onChange={(event) => setSettings((current) => current ? { ...current, current_game_visibility: event.target.value as ProfileSettings["current_game_visibility"] } : current)}><option value="everyone">Everyone</option><option value="friends">Friends only</option><option value="nobody">Nobody</option></select></label>
            <label>Recent games visibility<select value={settings?.recent_games_visibility ?? "everyone"} onChange={(event) => setSettings((current) => current ? { ...current, recent_games_visibility: event.target.value as ProfileSettings["recent_games_visibility"] } : current)}><option value="everyone">Everyone</option><option value="friends">Friends only</option><option value="nobody">Nobody</option></select></label>
            <button className="fit" type="submit" disabled={!settings || settingsBusy}>{settingsBusy ? "Saving..." : "Save social settings"}</button>
          </form>
        </section>
        <div className="results-panel profile-section">
          <div className="results-heading">
            <div>
              <p className="eyebrow">Library</p>
              <h2>{savedGames.length ? `${savedGames.length} games` : "Your library"}</h2>
            </div>
            <Link className="muted-link" href="/favorites">
              Manage
            </Link>
          </div>

          {savedGames.length === 0 ? (
            <div className="empty-state compact-empty">
              <p>No games in your library yet.</p>
              <Link className="button secondary fit" href="/">
                Find games
              </Link>
            </div>
          ) : (
            <div className="profile-saved-list">
              {savedGames.slice(0, 3).map((game) => {
                const matchedGame = imageMap[game.id];
                return (
                  <article className="profile-saved-row" key={game.id}>
                    <div className="saved-thumb mini">
                      {matchedGame?.background_image ? (
                        <Image src={matchedGame.background_image} alt="" fill sizes="48px" />
                      ) : (
                        <span>{game.title.slice(0, 2).toUpperCase()}</span>
                      )}
                    </div>
                    <div>
                      <h3>{game.title}</h3>
                      <p>
                        {game.source === "steam"
                          ? `Steam${game.playtime_forever ? ` · ${Math.round((game.playtime_forever / 60) * 10) / 10} h played` : ""}`
                          : game.source === "psn"
                            ? "PlayStation import"
                          : game.notes || game.info || "Saved manually"}
                      </p>
                    </div>
                    <span>{new Date(game.created_at).toLocaleDateString()}</span>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        <details
          className="results-panel profile-section profile-disclosure"
          open={openProfileSection === "psn"}
          onToggle={(event) => setOpenProfileSection(event.currentTarget.open ? "psn" : null)}
        >
          <summary className="profile-disclosure-summary">
            <div>
              <p className="eyebrow">PlayStation library</p>
              <h2>Import your PSN data</h2>
            </div>
            <span aria-hidden="true">+</span>
          </summary>

          <div className="empty-state compact-empty profile-disclosure-body">
            <p>
              In PlayStation Account Management, open Privacy Settings → Data Access Requests → Request Data. Sony emails an Excel export when it is ready.
            </p>
            <p>
              Upload only that .xlsx file. We do not ask for your PSN password, cookies, or NPSSO token, and the original file is not stored.
            </p>
            <a
              className="muted-link"
              href="https://www.playstation.com/en-au/support/account/data-request/"
              target="_blank"
              rel="noreferrer"
            >
              Open PlayStation instructions
            </a>
            <label className="button secondary fit" aria-disabled={psnBusy}>
              {psnBusy ? "Reading export..." : "Choose PSN Excel"}
              <input
                hidden
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                disabled={psnBusy}
                onChange={(event) => previewPsnFile(event.target.files?.[0])}
              />
            </label>
            {psnPreview && (
              <div className="stack">
                <p>{psnPreview.message}</p>
                <p>{psnPreview.games.slice(0, 12).join(" · ")}{psnPreview.total > 12 ? " · …" : ""}</p>
                <button type="button" onClick={importPsnGames} disabled={psnBusy}>
                  Import {psnPreview.total} games
                </button>
              </div>
            )}
          </div>
        </details>

        <details
          className="results-panel profile-section profile-disclosure"
          open={openProfileSection === "telegram"}
          onToggle={(event) => setOpenProfileSection(event.currentTarget.open ? "telegram" : null)}
        >
          <summary className="profile-disclosure-summary">
            <div>
              <p className="eyebrow">Telegram alerts</p>
              <h2>{telegram?.linked ? "Connected" : "Not connected"}</h2>
            </div>
            <span aria-hidden="true">+</span>
          </summary>

          <div className="empty-state compact-empty profile-disclosure-body">
            <p>
              {telegram?.linked
                ? `Alerts will be sent to ${telegram.username ? `@${telegram.username}` : "your Telegram chat"}.`
                : "Connect Telegram to receive future price and release alerts from your saved games."}
            </p>
            <div className="actions">
              {telegram?.linked ? (
                <>
                  <button className="secondary" type="button" onClick={sendTelegramTest} disabled={telegramBusy}>
                    Send test
                  </button>
                  <button className="secondary" type="button" onClick={disconnectTelegram} disabled={telegramBusy}>
                    Disconnect
                  </button>
                </>
              ) : (
                <button type="button" onClick={connectTelegram} disabled={telegramBusy}>
                  Connect Telegram
                </button>
              )}
            </div>
          </div>
        </details>
      </section>
    </section>
  );
}
