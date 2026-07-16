"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Panel, Section, StatePanel } from "@/components/ui";
import { ApiError, SteamSocial, getSteamSocial, isAuthenticated } from "@/lib/api";

type LoadError = { message: string; steamNotLinked: boolean };

function messageForError(reason: unknown): LoadError {
  if (reason instanceof ApiError) {
    return {
      message: reason.message,
      steamNotLinked: reason.status === 409,
    };
  }

  return { message: "Could not load Steam friends.", steamNotLinked: false };
}

export function FriendsScreen() {
  const authenticated = isAuthenticated();
  const [social, setSocial] = useState<SteamSocial | null>(null);
  const [error, setError] = useState<LoadError | null>(null);
  const [loading, setLoading] = useState(authenticated);
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    if (!authenticated) return;

    let active = true;

    getSteamSocial()
      .then((data) => {
        if (active) {
          setSocial(data);
          setError(null);
        }
      })
      .catch((reason) => active && setError(messageForError(reason)))
      .finally(() => active && setLoading(false));

    return () => {
      active = false;
    };
  }, [authenticated, loadAttempt]);

  if (!authenticated) {
    return <StatePanel kind="unauthenticated" title="Sign in to see friends" detail="Sign in before viewing Steam friend data." />;
  }

  if (loading) {
    return <main className="stack"><h1>Friends</h1><StatePanel kind="loading" title="Loading Steam friends" /></main>;
  }

  if (error?.steamNotLinked) {
    return (
      <main className="stack">
        <StatePanel kind="empty" title="Connect Steam to see friends" detail="Steam friend data is available after you link your account." />
        <Link href="/steam">Connect Steam</Link>
      </main>
    );
  }

  if (error) {
    return <StatePanel kind="error" title="Friends are unavailable" detail={error.message} action={{ label: "Retry", onClick: () => { setLoading(true); setLoadAttempt((attempt) => attempt + 1); } }} />;
  }

  if (!social || social.friends.length === 0) {
    return <StatePanel kind="empty" title="No Steam friends available" detail="Steam did not return any friends with visible libraries." />;
  }

  return (
    <main className="stack">
      <header className="section-header">
        <p className="eyebrow">Steam social</p>
        <h1>Friends</h1>
        <p>{social.public_libraries} public friend libraries available.</p>
      </header>
      <div className="stack">
        {social.friends.map((friend) => (
          <Panel as="article" key={friend.steam_id} className="stack">
            <div>
              {friend.avatar ? (
                // Steam provides remote avatar URLs that are not configured for Next's image optimizer.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={friend.avatar} alt={`${friend.persona_name ?? "Steam friend"}'s Steam avatar`} width={48} height={48} />
              ) : null}
              <h2>{friend.persona_name ?? "Steam friend"}</h2>
              <p>{friend.common_games_count} games in common</p>
              <p>{friend.taste_match_percent}% taste match</p>
            </div>
            {friend.common_games.length ? <p>Shared games: {friend.common_games.map((game, index) => <span key={game.appid}>{index ? ", " : ""}{game.name}</span>)}</p> : <p>No shared games returned.</p>}
          </Panel>
        ))}
      </div>
      <Section title="Top shared games" detail="Games returned across your Steam friends' public libraries.">
        {social.top_friend_games.length ? (
          <div className="stack">
            {social.top_friend_games.map((game) => <Panel as="article" key={game.appid}><h3>{game.name}</h3><p>{game.friends} friends own this game.</p></Panel>)}
          </div>
        ) : <p>No top shared games returned.</p>}
      </Section>
    </main>
  );
}
