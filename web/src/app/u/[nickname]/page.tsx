"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiError, PublicProfile, getPublicProfile } from "@/lib/api";

export default function PublicProfilePage() {
  const params = useParams<{ nickname: string }>();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { getPublicProfile(params.nickname).then(setProfile).catch((err) => setError(err instanceof ApiError && err.status === 404 ? "This profile was not found." : "Could not load this profile.")); }, [params.nickname]);
  if (error) return <section className="stack"><p className="alert error" role="alert">{error}</p><Link className="button secondary fit" href="/friends">Back to friends</Link></section>;
  if (!profile) return <p className="alert">Loading profile...</p>;
  return <section className="stack public-profile"><div className="section-header"><p className="eyebrow">Game Finder profile</p><h1>{profile.nickname}</h1><p>Shared gaming activity.</p></div><section className="results-panel stack"><div><p className="eyebrow">Platforms</p><h2>{profile.platforms.length ? profile.platforms.join(" · ") : "No platforms shared"}</h2></div>{profile.current_game && <div className="friend-section"><span>Playing now</span><p>{profile.current_game}</p></div>}{profile.recent_games.length > 0 && <div className="friend-section"><span>Recent games</span><p>{profile.recent_games.join(" · ")}</p></div>}{!profile.current_game && profile.recent_games.length === 0 && <p>This player has not shared game activity.</p>}</section></section>;
}
