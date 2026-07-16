"use client";

import { SearchScreen } from "@/features/discovery/SearchScreen";

export default function SearchPage() {
  const initialQuery = typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("q") ?? "";
  return <SearchScreen initialQuery={initialQuery} />;
}
