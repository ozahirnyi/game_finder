"use client";

import { useEffect, useState } from "react";
import { Avatar } from "@/components/GameCover";
import { getSteamLibrary, type SteamAccount, type SteamGame } from "@/lib/api";

type LibraryState =
  | { status: "loading" }
  | { status: "success"; games: SteamGame[] }
  | { status: "error" };

export function PersonalDashboard({
  steamAccount,
}: {
  steamAccount: SteamAccount;
}) {
  const [retry, setRetry] = useState(0);
  const [library, setLibrary] = useState<LibraryState>({ status: "loading" });
  const name = steamAccount.persona_name ?? "Steam player";

  useEffect(() => {
    let active = true;
    setLibrary({ status: "loading" });
    void getSteamLibrary()
      .then(
        (response) =>
          active && setLibrary({ status: "success", games: response.games }),
      )
      .catch(() => active && setLibrary({ status: "error" }));
    return () => {
      active = false;
    };
  }, [retry]);

  return (
    <div className="stack page-enter">
      <header className="section-header">
        <div className="flex items-center gap-3">
          {steamAccount.avatar ? (
            <img
              className="size-12 rounded-full"
              src={steamAccount.avatar}
              alt={`${name} avatar`}
            />
          ) : (
            <Avatar
              from="#4f46e5"
              to="#0f766e"
              name={name}
              className="size-12 rounded-full"
            />
          )}
          <div>
            <p className="eyebrow">Your Steam dashboard</p>
            <h1>{name}</h1>
          </div>
        </div>
      </header>

      <section
        className="stack stagger-enter"
        aria-labelledby="steam-library-heading"
      >
        <div>
          <p className="eyebrow">Steam library</p>
          <h2 id="steam-library-heading">Your games</h2>
        </div>
        {library.status === "loading" ? (
          <div
            className="skeleton-shimmer"
            aria-label="Loading Steam library"
          />
        ) : null}
        {library.status === "error" ? (
          <div className="state-panel">
            <p>Steam library could not be loaded.</p>
            <button
              type="button"
              onClick={() => setRetry((value) => value + 1)}
            >
              Retry library
            </button>
          </div>
        ) : null}
        {library.status === "success" && library.games.length === 0 ? (
          <p>Your Steam library is ready to sync.</p>
        ) : null}
        {library.status === "success" && library.games.length > 0 ? (
          <ul className="stack compact">
            {library.games.slice(0, 6).map((game) => (
              <li key={game.appid}>{game.name}</li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="stack stagger-enter">
        <p className="eyebrow">More to explore</p>
        <h2>Friends and recommendations</h2>
        <p>
          Connect more Steam data from your profile to unlock these personal
          views.
        </p>
      </section>
    </div>
  );
}
