"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { GameCover } from "@/components/GameCover";
import { StatePanel } from "@/components/ui";
import { getTrendingGames, getUpcomingGames, type SearchGame } from "@/lib/api";

type RemoteState<T> = { status: "loading" } | { status: "error"; message: string } | { status: "success"; data: T };

function GameRegion({ title, games, retryLabel, onRetry }: { title: string; games: RemoteState<SearchGame[]>; retryLabel: string; onRetry: () => void }) {
  if (games.status === "loading") return <StatePanel kind="loading" title={`Loading ${title.toLowerCase()}`} />;
  if (games.status === "error") return <StatePanel kind="error" title={`Could not load ${title.toLowerCase()}`} detail={games.message} action={{ label: retryLabel, onClick: onRetry }} />;
  if (!games.data.length) return <StatePanel kind="empty" title={`No ${title.toLowerCase()} yet`} />;
  return <div className="game-grid">{games.data.map((game) => <article key={game.id ?? game.name} className="game-card"><GameCover title={game.name ?? "Game"} src={game.background_image} /><h3>{game.name ?? "Untitled game"}</h3>{game.id ? <Link href={`/games/${game.id}`}>View details</Link> : null}</article>)}</div>;
}

export function DiscoveryScreen() {
  const [trending, setTrending] = useState<RemoteState<SearchGame[]>>({ status: "loading" });
  const [upcoming, setUpcoming] = useState<RemoteState<SearchGame[]>>({ status: "loading" });
  const [trendingRetry, setTrendingRetry] = useState(0);
  const [upcomingRetry, setUpcomingRetry] = useState(0);

  useEffect(() => { let active = true; void getTrendingGames(8).then((data) => active && setTrending({ status: "success", data: data.results })).catch(() => active && setTrending({ status: "error", message: "Try again shortly." })); return () => { active = false; }; }, [trendingRetry]);
  useEffect(() => { let active = true; void getUpcomingGames(8).then((data) => active && setUpcoming({ status: "success", data: data.results })).catch(() => active && setUpcoming({ status: "error", message: "Try again shortly." })); return () => { active = false; }; }, [upcomingRetry]);

  return <div className="stack"><header className="section-header"><p className="eyebrow">Discover</p><h1>Find your next game</h1><Link href="/search">Search the catalog</Link></header><section><h2>Trending now</h2><GameRegion title="Trending games" games={trending} retryLabel="Retry" onRetry={() => { setTrending({ status: "loading" }); setTrendingRetry((value) => value + 1); }} /></section><section><h2>Coming soon</h2><GameRegion title="Upcoming games" games={upcoming} retryLabel="Retry" onRetry={() => { setUpcoming({ status: "loading" }); setUpcomingRetry((value) => value + 1); }} /></section></div>;
}
