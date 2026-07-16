"use client";

import { useParams } from "next/navigation";
import { SavedGameDetailScreen } from "@/features/library/SavedGameDetailScreen";

export default function SavedGamePage() {
  const params = useParams<{ id: string }>();
  return <SavedGameDetailScreen id={params.id} />;
}
