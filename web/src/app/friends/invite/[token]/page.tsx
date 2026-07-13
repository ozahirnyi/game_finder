"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiError, acceptFriendInvite, isAuthenticated, resolveFriendInvite } from "@/lib/api";

type InviteState = "loading" | "login" | "ready" | "invalid" | "accepted" | "error";

export function InvitePageContent({ state, ownerNickname, onAccept, error, loginHref }: { state: InviteState; ownerNickname?: string; onAccept?: () => void; error?: string; loginHref?: string }) {
  if (state === "loading") return <p className="alert">Loading invite...</p>;
  if (state === "login") return <section className="stack"><p className="alert">Log in to view and accept this friend invite.</p><Link className="button fit" href={loginHref ?? "/login"}>Log in to continue</Link></section>;
  if (state === "invalid") return <section className="stack"><p className="alert error" role="alert">This invite is invalid or has been rotated.</p><Link className="button secondary fit" href="/friends">Back to friends</Link></section>;
  if (state === "error") return <section className="stack"><p className="alert error" role="alert">{error ?? "Could not load this invite."}</p><Link className="button secondary fit" href="/friends">Back to friends</Link></section>;
  if (state === "accepted") return <section className="stack"><p className="alert success" role="status">You are now friends with {ownerNickname}.</p><Link className="button fit" href="/friends">Open friends</Link></section>;
  return <section className="stack"><div className="section-header"><p className="eyebrow">Game Finder invite</p><h1>Join {ownerNickname}&apos;s gaming circle?</h1><p>Accept this invitation to add each other as friends.</p></div><button className="fit" type="button" onClick={onAccept}>Accept invite</button></section>;
}

export default function FriendInvitePage() {
  const params = useParams<{ token: string }>();
  const [state, setState] = useState<InviteState>("loading");
  const [ownerNickname, setOwnerNickname] = useState("");
  const [error, setError] = useState("");
  const authenticated = isAuthenticated();

  useEffect(() => {
    if (!authenticated) return;
    resolveFriendInvite(params.token).then((invite) => { setOwnerNickname(invite.owner_nickname); setState("ready"); }).catch((err) => {
      if (err instanceof ApiError && err.status === 404) setState("invalid");
      else { setError("Could not load this invite. Please try again."); setState("error"); }
    });
  }, [authenticated, params.token]);

  async function accept() {
    setError("");
    try { await acceptFriendInvite(params.token); setState("accepted"); }
    catch (err) {
      if (err instanceof ApiError && err.status === 404) setState("invalid");
      else { setError(err instanceof ApiError ? err.message : "Could not accept this invite. Please try again."); setState("error"); }
    }
  }

  const loginHref = `/login?next=${encodeURIComponent(`/friends/invite/${params.token}`)}&message=${encodeURIComponent("Log in to accept this invite.")}`;
  return <InvitePageContent state={authenticated ? state : "login"} ownerNickname={ownerNickname} onAccept={accept} error={error} loginHref={loginHref} />;
}
