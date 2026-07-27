"use client";

import { useState } from "react";
import { getSteamLoginUrl } from "@/lib/api";

export function SteamConnectPrompt() {
  const [opening, setOpening] = useState(false);

  async function connectSteam() {
    setOpening(true);
    try {
      const { url } = await getSteamLoginUrl();
      window.location.assign(url);
    } finally {
      setOpening(false);
    }
  }

  return (
    <section className="stack page-enter">
      <p className="eyebrow">Personalize GameFinder</p>
      <h1>Connect Steam to personalize GameFinder</h1>
      <p>
        Import your library to see recommendations and game activity tailored to
        you.
      </p>
      <button
        type="button"
        onClick={() => void connectSteam()}
        disabled={opening}
      >
        {opening ? "Opening Steam…" : "Connect Steam"}
      </button>
    </section>
  );
}
