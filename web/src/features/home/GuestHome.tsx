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
    if (query.trim())
      void navigate({ to: "/search", search: { q: query.trim() } });
  }

  return (
    <div
      className="page-enter mx-auto max-w-6xl space-y-10"
      data-testid="guest-home"
    >
      <section className="rounded-3xl border border-border bg-surface p-6 sm:p-10">
        <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.25em] text-primary">
          GameFinder
        </p>
        <h1 className="text-4xl font-extrabold tracking-tight text-balance sm:text-5xl">
          Find your next game
        </h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Search games, discover new favourites, and find live price drops
          before you sign in.
        </p>
        <form
          className="mt-6 flex flex-col gap-3 sm:flex-row"
          onSubmit={submit}
        >
          <input
            className="min-w-0 flex-1 rounded-xl border border-border bg-surface px-4 py-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
            type="search"
            role="searchbox"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search games by title"
            aria-label="Search games"
          />
          <button
            className="rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            type="submit"
          >
            Search games
          </button>
        </form>
      </section>
      <PublicDeals initialCountry={initialCountry()} limit={6} />
    </div>
  );
}
