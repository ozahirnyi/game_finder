"use client";

import { useSyncExternalStore } from "react";
import { getAuthSnapshot, subscribeToAuthChanges } from "@/lib/api";

export function useAuthState() {
  return useSyncExternalStore(subscribeToAuthChanges, getAuthSnapshot, () => false);
}
