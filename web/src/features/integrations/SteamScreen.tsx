"use client";

import { useEffect, useState } from "react";
import type { RecommendationItem, SteamAccount, SteamGame, SteamSocial } from "@/lib/api";
import { getSteamAccount, getSteamLibrary, getSteamLoginUrl, getSteamRecommendations, getSteamSocial, isAuthenticated } from "@/lib/api";
import { Badge, Button, Panel, Section, StatePanel } from "@/components/ui";

function failureMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function SteamScreen() {
  const authenticated = isAuthenticated();
  const [account, setAccount] = useState<SteamAccount | null>(null);
  const [games, setGames] = useState<SteamGame[]>([]);
  const [social, setSocial] = useState<SteamSocial | null>(null);
  const [recommendations, setRecommendations] = useState<RecommendationItem[]>([]);
  const [loading, setLoading] = useState(authenticated);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!authenticated) return;
    let active = true;
    getSteamAccount()
      .then(async (steam) => {
        if (!active) return;
        setAccount(steam);
        if (steam.linked) {
          const [library, socialData] = await Promise.all([getSteamLibrary(), getSteamSocial()]);
          if (active) { setGames(library.games); setSocial(socialData); }
        }
      })
      .catch((reason: unknown) => active && setError(failureMessage(reason, "Could not load Steam.")))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [authenticated]);

  async function connect() {
    setBusy(true); setError("");
    try {
      const { url } = await getSteamLoginUrl();
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (reason) {
      setError(failureMessage(reason, "Could not open Steam sign-in."));
    } finally { setBusy(false); }
  }

  async function loadRecommendations() {
    setBusy(true); setError("");
    try { setRecommendations((await getSteamRecommendations()).recommendations); }
    catch (reason) { setError(failureMessage(reason, "Could not load recommendations.")); }
    finally { setBusy(false); }
  }

  if (!authenticated) return <StatePanel kind="unauthenticated" title="Sign in to connect Steam" detail="Your Steam library stays private until you sign in." />;
  if (loading) return <StatePanel kind="loading" title="Loading Steam" />;
  if (error) return <StatePanel kind="error" title="Steam is unavailable" detail={error} action={{ label: "Try again", onClick: () => window.location.reload() }} />;
  if (!account?.linked) return <StatePanel kind="empty" title="Connect your Steam account" detail="Import your owned games and receive library-based recommendations." action={{ label: busy ? "Opening Steam..." : "Connect Steam", onClick: connect }} />;

  return <div className="stack">
    <header className="section-header"><p className="eyebrow">Steam</p><h1>{account.persona_name ?? "Your Steam library"}</h1><p>{games.length} games returned by Steam.</p></header>
    <Section title="Library" detail="Your games, as returned by Steam."><div className="favorites-list">
      {games.length ? games.map((game) => <Panel as="article" key={game.appid}><h3>{game.name}</h3><p>{Math.round(game.playtime_forever / 60)} hours played</p></Panel>) : <StatePanel kind="empty" title="No Steam games available" detail="Steam may be unable to read this library." />}
    </div></Section>
    <Section title="Friends' games" detail={social ? `${social.public_libraries} public friend librar${social.public_libraries === 1 ? "y" : "ies"} available.` : "Steam did not return friend-library data."}>
      {social?.top_friend_games.length ? <div className="favorites-list">{social.top_friend_games.map((game) => <Panel as="article" key={game.appid}><h3>{game.name}</h3><p>{game.friends} friends own this game.</p></Panel>)}</div> : <p>No shared friend-library games returned.</p>}
    </Section>
    <Section title="Recommendations" detail="Based on your connected library." action={<Button disabled={busy} onClick={loadRecommendations}>{busy ? "Loading..." : "Get recommendations"}</Button>}>
      {recommendations.length ? <div className="favorites-list">{recommendations.map((item) => <Panel as="article" key={`${item.title}-${item.reason}`}><h3>{item.title}</h3><p>{item.reason}</p>{item.tags.map((tag) => <Badge key={tag}>{tag}</Badge>)}</Panel>)}</div> : <p>No recommendations loaded yet.</p>}
    </Section>
  </div>;
}
