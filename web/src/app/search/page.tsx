"use client";

import { Suspense } from "react";
import { useRouterState } from "@tanstack/react-router";
import { SearchScreen } from "@/features/discovery/SearchScreen";

function SearchRoute() {
  const query =
    new URLSearchParams(
      useRouterState({ select: (state) => state.location.searchStr }),
    ).get("q") ?? "";
  return <SearchScreen key={query} initialQuery={query} />;
}

export default function SearchPage() {
  return (
    <Suspense fallback={<SearchScreen initialQuery="" />}>
      <SearchRoute />
    </Suspense>
  );
}
