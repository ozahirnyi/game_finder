"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { GameCover } from "@/components/GameCover";
import { StatePanel } from "@/components/ui";
import { getTrendingGames, getUpcomingGames, type SearchGame } from "@/lib/api";

type RemoteState<T> = { status: "loading" } | { status: "error"; message: string } | { status: "success"; data: T };

function GameRegion({ title, games, onRetry }: { title: string; games: RemoteState<SearchGame[]>; onRetry: () => void }) {
  if (games.status === "loading") return <StatePanel kind="loading" title={`Loading ${title.toLowerCase()}`} />;
  if (games.status === "error") return <StatePanel kind="error" title={`Could not load ${title.toLowerCase()}`} detail={games.message} action={{ label: "Retry", onClick: onRetry }} />;
  if (!games.data.length) return <StatePanel kind="empty" title={`No ${title.toLowerCase()} yet`} />;
  return <div className="game-grid">{games.data.map((game) => <article key={game.id ?? game.name} className="game-card"><GameCover title={game.name ?? "Game"} src={game.background_image} /><h3>{game.name ?? "Untitled game"}</h3>{game.id ? <Link href={`/games/${game.id}`}>View details</Link> : null}</article>)}</div>;
}

export function DiscoveryScreen() {
  const [trending, setTrending] = useState<RemoteState<SearchGame[]>>({ status: "loading" });
  const [upcoming, setUpcoming] = useState<RemoteState<SearchGame[]>>({ status: "loading" });
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setTrending({ status: "loading" }); setUpcoming({ status: "loading" });
      const [trendingResult, upcomingResult] = await Promise.allSettled([getTrendingGames(8), getUpcomingGames(8)]);
      if (!active) return;
      setTrending(trendingResult.status === "fulfilled" ? { status: "success", data: trendingResult.value.results } : { status: "error", message: "Try again shortly." });
      setUpcoming(upcomingResult.status === "fulfilled" ? { status: "success", data: upcomingResult.value.results } : { status: "error", message: "Try again shortly." });
    };
    void load();
    return () => { active = false; };
  }, [retry]);

  return <div className="stack"><header className="section-header"><p className="eyebrow">Discover</p><h1>Find your next game</h1><Link href="/search">Search the catalog</Link></header><section><h2>Trending now</h2><GameRegion title="Trending games" games={trending} onRetry={() => setRetry((value) => value + 1)} /></section><section><h2>Coming soon</h2><GameRegion title="Upcoming games" games={upcoming} onRetry={() => setRetry((value) => value + 1)} /></section></div>;
}
