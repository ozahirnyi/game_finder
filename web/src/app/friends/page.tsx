"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { ApiError, FriendCard, FriendInvite, FriendshipRequest, FriendsContacts, PsnContact, cancelFriendRequest, createFriendRequest, createPsnContact, deleteFriend, deletePsnContact, getFriendsContacts, getManualActivity, getProfileSettings, isAuthenticated, listFriendRequests, listPsnContacts, rotateFriendInvite, respondToFriendRequest, syncSteamContacts, updateManualActivity, updatePsnContact } from "@/lib/api";

function errorMessage(error: unknown, fallback: string) { return error instanceof ApiError ? error.message : fallback; }

export default function FriendsPage() {
  const router = useRouter();
  const [contacts, setContacts] = useState<FriendsContacts | null>(null);
  const [requests, setRequests] = useState<FriendshipRequest[]>([]);
  const [psnContacts, setPsnContacts] = useState<PsnContact[]>([]);
  const [invite, setInvite] = useState<FriendInvite | null>(null);
  const [ownNickname, setOwnNickname] = useState<string | null>(null);
  const [nickname, setNickname] = useState("");
  const [onlineId, setOnlineId] = useState("");
  const [editingPsn, setEditingPsn] = useState<string | null>(null);
  const [currentGame, setCurrentGame] = useState("");
  const [recentGames, setRecentGames] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async (hydrateActivity = false) => {
    const [contactsData, requestData, psnData, settings] = await Promise.all([getFriendsContacts(), listFriendRequests(), listPsnContacts(), getProfileSettings()]);
    setContacts(contactsData); setRequests(requestData); setPsnContacts(psnData); setOwnNickname(settings.nickname);
    if (hydrateActivity) {
      const activity = await getManualActivity();
      setCurrentGame(activity.current_game ?? ""); setRecentGames(activity.recent_games.join(", "));
    }
  }, []);
  useEffect(() => {
    if (!isAuthenticated()) { router.push("/login?message=Log in to manage friends."); return; }
    const timer = window.setTimeout(() => { void load(true).catch((err) => setError(errorMessage(err, "Could not load friends."))).finally(() => setLoading(false)); }, 0);
    return () => window.clearTimeout(timer);
  }, [load, router]);
  async function run(action: () => Promise<void>, success: string) { setBusy(true); setError(""); setMessage(""); try { await action(); setMessage(success); } catch (err) { setError(errorMessage(err, "Could not update friends.")); } finally { setBusy(false); } }
  function submitRequest(event: FormEvent) { event.preventDefault(); run(async () => { await createFriendRequest(nickname); setNickname(""); await load(); }, "Friend request sent."); }
  function submitPsn(event: FormEvent) { event.preventDefault(); run(async () => { await createPsnContact(onlineId); setOnlineId(""); await load(); }, "PSN contact added."); }
  function submitActivity(event: FormEvent) { event.preventDefault(); run(async () => { const activity = await updateManualActivity({ current_game: currentGame.trim() || null, recent_games: recentGames.split(",").map((game) => game.trim()).filter(Boolean) }); setCurrentGame(activity.current_game ?? ""); setRecentGames(activity.recent_games.join(", ")); await load(); }, "Current game updated."); }
  async function copyInvite() { if (!invite) return; try { await navigator.clipboard.writeText(invite.url); setMessage("Invite link copied."); } catch { setError("Could not copy the invite link. Select and copy it manually."); } }
  if (loading) return <p className="alert">Loading friends...</p>;
  return <section className="stack friends-page">
    <div className="section-header"><p className="eyebrow">Friends</p><h1>Your gaming circle</h1><p>Keep Game Finder, Steam, and PlayStation contacts together.</p></div>
    {error && <p className="alert error" role="alert">{error}</p>}{message && <p className="alert success" role="status">{message}</p>}
    <section className="results-panel"><div className="results-heading"><div><p className="eyebrow">Contacts</p><h2>All contacts</h2></div><button type="button" className="secondary fit" disabled={busy} onClick={() => run(async () => { const updated = await syncSteamContacts(); setContacts(updated); }, "Steam contacts refreshed.")}>Refresh Steam</button></div>
      {contacts?.sources.steam?.error && <p className="alert">Steam: {contacts.sources.steam.error}</p>}
      <div className="friend-list">{contacts?.contacts.map((contact) => <ContactCard key={contact.id} contact={contact} onRemove={contact.source === "site" && contact.id.startsWith("site:") ? () => run(async () => { await deleteFriend(contact.id.slice(5)); await load(); }, "Friend removed.") : undefined} />) ?? null}</div>
      {!contacts?.contacts.length && <p className="empty-state compact-empty">No contacts yet. Send a request, add a PSN contact, or sync Steam.</p>}
    </section>
    <div className="friends-grid">
      <section className="results-panel stack"><div><p className="eyebrow">Game Finder</p><h2>Add by nickname</h2></div><form className="inline-form" onSubmit={submitRequest}><label className="sr-only" htmlFor="friend-nickname">Nickname</label><input id="friend-nickname" value={nickname} minLength={3} maxLength={32} onChange={(event) => setNickname(event.target.value)} placeholder="Player nickname" required /><button type="submit" disabled={busy}>Send request</button></form>
        {requests.length > 0 && <div className="stack"><h3>Requests</h3>{requests.map((request) => { const isIncoming = request.recipient_nickname === ownNickname; return <div className="friend-request" key={request.id}><span>{isIncoming ? `${request.requester_nickname} wants to connect` : `Request sent to ${request.recipient_nickname}`}</span><div className="actions">{isIncoming ? <><button type="button" className="secondary fit" disabled={busy} onClick={() => run(async () => { await respondToFriendRequest(request.id, "accepted"); await load(); }, "Request accepted.")}>Accept</button><button type="button" className="secondary fit" disabled={busy} onClick={() => run(async () => { await respondToFriendRequest(request.id, "declined"); await load(); }, "Request declined.")}>Decline</button></> : <button type="button" className="secondary fit" disabled={busy} onClick={() => run(async () => { await cancelFriendRequest(request.id); await load(); }, "Request cancelled.")}>Cancel</button>}</div></div>; })}</div>}
      </section>
      <section className="results-panel stack"><div><p className="eyebrow">Invite link</p><h2>Share with a friend</h2></div><p>Create a reusable link. Rotating it invalidates the previous link.</p><div className="actions"><button type="button" disabled={busy} onClick={() => run(async () => setInvite(await rotateFriendInvite()), "Invite link created.")}>{invite ? "Rotate invite" : "Create invite"}</button>{invite && <button type="button" className="secondary" onClick={copyInvite}>Copy link</button>}</div>{invite && <input aria-label="Invite link" readOnly value={invite.url} onFocus={(event) => event.currentTarget.select()} />}</section>
      <section className="results-panel stack"><div><p className="eyebrow">PlayStation</p><h2>Manual PSN contacts</h2></div><form className="inline-form" onSubmit={submitPsn}><label className="sr-only" htmlFor="psn-online-id">PSN Online ID</label><input id="psn-online-id" value={onlineId} minLength={3} maxLength={16} onChange={(event) => setOnlineId(event.target.value)} placeholder="PSN Online ID" required /><button type="submit" disabled={busy}>Add</button></form>{psnContacts.map((contact) => <div className="friend-request" key={contact.id}>{editingPsn === contact.id ? <form className="inline-form" onSubmit={(event) => { event.preventDefault(); run(async () => { await updatePsnContact(contact.id, onlineId); setEditingPsn(null); setOnlineId(""); await load(); }, "PSN contact updated."); }}><label className="sr-only" htmlFor={`psn-${contact.id}`}>PSN Online ID</label><input id={`psn-${contact.id}`} value={onlineId} minLength={3} maxLength={16} onChange={(event) => setOnlineId(event.target.value)} required /><button type="submit" disabled={busy}>Save</button></form> : <a href={contact.profile_url} target="_blank" rel="noreferrer">{contact.online_id}</a>}<div className="actions"><button type="button" className="secondary fit" disabled={busy} onClick={() => { setEditingPsn(editingPsn === contact.id ? null : contact.id); setOnlineId(editingPsn === contact.id ? "" : contact.online_id); }}>{editingPsn === contact.id ? "Close" : "Edit"}</button><button type="button" className="secondary fit" disabled={busy} onClick={() => run(async () => { await deletePsnContact(contact.id); await load(); }, "PSN contact removed.")}>Remove</button></div></div>)}</section>
      <section className="results-panel stack"><div><p className="eyebrow">Your activity</p><h2>Manual current game</h2></div><form className="stack" onSubmit={submitActivity}><label>Playing now<input value={currentGame} maxLength={255} onChange={(event) => setCurrentGame(event.target.value)} placeholder="e.g. Hades" /></label><label>Recent games <span className="muted">(comma separated)</span><input value={recentGames} onChange={(event) => setRecentGames(event.target.value)} placeholder="Hades, Balatro" /></label><button type="submit" disabled={busy}>Save activity</button></form></section>
    </div>
  </section>;
}

function ContactCard({ contact, onRemove }: { contact: FriendCard; onRemove?: () => void }) { return <article className="friend-card"><div className="friend-header">{contact.avatar ? <img src={contact.avatar} alt="" /* eslint-disable-line @next/next/no-img-element */ /> : <span className="avatar-placeholder" aria-hidden="true">{contact.nickname?.slice(0, 1).toUpperCase() || "?"}</span>}<div><h3>{contact.nickname || "Unknown contact"}</h3><p>{contact.source === "site" ? "Game Finder" : contact.source === "psn" ? "PlayStation" : "Steam"}</p></div>{onRemove && <button type="button" className="secondary fit" onClick={onRemove}>Remove</button>}</div>{contact.current_game && <div className="friend-section"><span>Playing now</span><p>{contact.current_game}</p></div>}{contact.recent_games.length > 0 && <div className="friend-section"><span>Recent games</span><p>{contact.recent_games.join(" · ")}</p></div>}{contact.profile_url && <a className="muted-link" href={contact.profile_url} target="_blank" rel="noreferrer">Open profile</a>}{contact.source === "site" && contact.nickname && <Link className="muted-link" href={`/u/${encodeURIComponent(contact.nickname)}`}>View Game Finder profile</Link>}</article>; }
