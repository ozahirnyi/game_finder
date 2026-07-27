"use client";

import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { initialCountry } from "./region";
import { PublicDeals } from "./PublicDeals";

export function GuestHome() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (query.trim()) void navigate({ to: "/search", search: { q: query.trim() } });
  }

  return (
    <div className="stack page-enter" data-testid="guest-home">
      <section className="stack">
        <p className="eyebrow">GameFinder</p>
        <h1>Find your next game</h1>
        <p>Search games, discover new favourites, and find live price drops before you sign in.</p>
        <form className="flex gap-2" onSubmit={submit}>
          <input
            type="search"
            role="searchbox"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search games by title"
            aria-label="Search games"
          />
          <button type="submit">Search games</button>
        </form>
      </section>
      <PublicDeals initialCountry={initialCountry()} limit={6} />
    </div>
  );
}
