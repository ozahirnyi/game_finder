"use client";

import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Panel, Section, StatePanel } from "@/components/ui";
import { acceptFriendRequest, ApiError, declineFriendRequest, getSocialSnapshot, getSteamSocial, isAuthenticated, type SocialSnapshot, type SocialUser, type SteamSocial, sendFriendRequest } from "@/lib/api";

type LoadError = { message: string; steamNotLinked: boolean };

function messageForError(reason: unknown): LoadError {
  if (reason instanceof ApiError) return { message: reason.message, steamNotLinked: reason.status === 409 };
  return { message: "Could not load Steam friends.", steamNotLinked: false };
}

function SocialPerson({ person, children }: { person: SocialUser; children?: React.ReactNode }) {
  return <Panel as="article" className="stack">
    <div>
      {person.avatar ? <img src={person.avatar} alt={`${person.display_name}'s avatar`} width={48} height={48} /> : null}
      <h3>{person.display_name}</h3>
    </div>
    {person.steam_profile_url ? <a href={person.steam_profile_url} target="_blank" rel="noopener noreferrer">Open Steam profile</a> : null}
    {person.steam_add_url ? <a href={person.steam_add_url} target="_blank" rel="noopener noreferrer">Add on Steam</a> : null}
    {children}
  </Panel>;
}

export function FriendsScreen() {
  const authenticated = isAuthenticated();
  const [social, setSocial] = useState<SocialSnapshot | null>(null);
  const [socialError, setSocialError] = useState("");
  const [socialLoading, setSocialLoading] = useState(authenticated);
  const [steam, setSteam] = useState<SteamSocial | null>(null);
  const [steamError, setSteamError] = useState<LoadError | null>(null);
  const [steamLoading, setSteamLoading] = useState(authenticated);
  const [steamAttempt, setSteamAttempt] = useState(0);
  const [actionError, setActionError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!authenticated) return;
    let active = true;
    getSocialSnapshot().then((data) => {
      if (active) { setSocial(data); setSocialError(""); }
    }).catch((reason: unknown) => active && setSocialError(reason instanceof Error ? reason.message : "Could not load GameFinder friends.")).finally(() => active && setSocialLoading(false));
    return () => { active = false; };
  }, [authenticated]);

  useEffect(() => {
    if (!authenticated) return;
    let active = true;
    setSteamLoading(true);
    getSteamSocial().then((data) => {
      if (active) { setSteam(data); setSteamError(null); }
    }).catch((reason) => active && setSteamError(messageForError(reason))).finally(() => active && setSteamLoading(false));
    return () => { active = false; };
  }, [authenticated, steamAttempt]);

  async function updateSocial(id: string, operation: () => Promise<SocialSnapshot>) {
    setBusyId(id); setActionError("");
    try { setSocial(await operation()); }
    catch (reason) { setActionError(reason instanceof Error ? reason.message : "Could not update friend request."); }
    finally { setBusyId(null); }
  }

  if (!authenticated) return <StatePanel kind="unauthenticated" title="Sign in to see friends" detail="Sign in before viewing friend data." />;

  const steamInformation = () => {
    if (steamLoading) return <StatePanel kind="loading" title="Loading Steam friends" />;
    if (steamError?.steamNotLinked) return <><StatePanel kind="empty" title="Connect Steam to see friends" detail="Steam friend data is available after you link your account." /><Link to="/steam">Connect Steam</Link></>;
    if (steamError) return <StatePanel kind="error" title="Friends are unavailable" detail={steamError.message} action={{ label: "Retry", onClick: () => setSteamAttempt((attempt) => attempt + 1) }} />;
    if (!steam || steam.friends.length === 0) return <StatePanel kind="empty" title="No Steam friends available" detail="Steam did not return any friends with visible libraries." />;
    return <><p>{steam.public_libraries} public friend libraries available.</p><div className="stack">{steam.friends.map((friend) => <Panel as="article" key={friend.steam_id} className="stack"><div>{friend.avatar ? <img src={friend.avatar} alt={`${friend.persona_name ?? "Steam friend"}'s Steam avatar`} width={48} height={48} /> : null}<h3>{friend.persona_name ?? "Steam friend"}</h3><p>{friend.common_games_count} games in common</p><p>{friend.taste_match_percent}% taste match</p></div>{friend.common_games.length ? <p>Shared games: {friend.common_games.map((game, index) => <span key={game.appid}>{index ? ", " : ""}{game.name}</span>)}</p> : <p>No shared games returned.</p>}</Panel>)}</div><Section title="Top shared games" detail="Games returned across your Steam friends' public libraries.">{steam.top_friend_games.length ? <div className="stack">{steam.top_friend_games.map((game) => <Panel as="article" key={game.appid}><h3>{game.name}</h3><p>{game.friends} friends own this game.</p></Panel>)}</div> : <p>No top shared games returned.</p>}</Section></>;
  };

  return <main className="stack">
    <header className="section-header"><p className="eyebrow">Friends</p><h1>Friends</h1></header>
    {actionError ? <p className="alert error">{actionError}</p> : null}
    {socialLoading ? <StatePanel kind="loading" title="Loading GameFinder friends" /> : null}
    {socialError ? <StatePanel kind="error" title="GameFinder friends are unavailable" detail={socialError} /> : null}
    {social ? <>
      {social.incoming_requests.length ? <Section title="Incoming friend requests"><div className="stack">{social.incoming_requests.map((request) => <SocialPerson key={request.id} person={request.sender}><div className="actions"><button type="button" disabled={busyId === request.id} onClick={() => void updateSocial(request.id, () => acceptFriendRequest(request.id))}>Accept {request.sender.display_name}</button><button type="button" disabled={busyId === request.id} onClick={() => void updateSocial(request.id, () => declineFriendRequest(request.id))}>Decline {request.sender.display_name}</button></div></SocialPerson>)}</div></Section> : null}
      <Section title="My GameFinder friends">{social.friends.length ? <div className="stack">{social.friends.map((friend) => <SocialPerson key={friend.id} person={friend} />)}</div> : <p>No GameFinder friends yet.</p>}</Section>
      <Section title="Friends from Steam on GameFinder" detail={social.steam_suggestions_error ?? "Steam contacts who are already on GameFinder."}>{social.steam_suggestions.length ? <div className="stack">{social.steam_suggestions.map((friend) => <SocialPerson key={friend.id} person={friend}><button type="button" disabled={busyId === friend.id} onClick={() => void updateSocial(friend.id, () => sendFriendRequest(friend.id))}>Add friend: {friend.display_name}</button></SocialPerson>)}</div> : <p>No Steam contacts on GameFinder are available right now.</p>}</Section>
    </> : null}
    <Section title="Steam library information" detail="Game overlap from your Steam friends' public libraries.">{steamInformation()}</Section>
  </main>;
}
