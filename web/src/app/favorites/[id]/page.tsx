"use client";

import { useRouterState } from "@tanstack/react-router";
import { SavedGameDetailScreen } from "@/features/library/SavedGameDetailScreen";

export default function SavedGamePage() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  return (
    <SavedGameDetailScreen
      id={pathname.split("/").filter(Boolean).at(-1) ?? ""}
    />
  );
}
