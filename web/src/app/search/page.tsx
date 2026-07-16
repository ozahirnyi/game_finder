"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { SearchScreen } from "@/features/discovery/SearchScreen";

function SearchRoute() {
  const query = useSearchParams().get("q") ?? "";
  return <SearchScreen key={query} initialQuery={query} />;
}

export default function SearchPage() {
  return <Suspense fallback={<SearchScreen initialQuery="" />}><SearchRoute /></Suspense>;
}
