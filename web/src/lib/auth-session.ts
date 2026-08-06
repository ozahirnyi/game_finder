import { queryOptions, type QueryClient } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";
import {
  clearToken,
  getAuthSnapshot,
  getCurrentUser,
  getToken,
  setToken,
  subscribeToAuthChanges,
} from "./api";

export function useAuthenticated() {
  return useSyncExternalStore(
    subscribeToAuthChanges,
    getAuthSnapshot,
    () => false,
  );
}

export function currentUserQueryOptions() {
  return queryOptions({
    queryKey: ["auth", "me"] as const,
    queryFn: getCurrentUser,
    enabled: Boolean(getToken()),
    meta: { auth: true },
  });
}

export function completeLogin(token: string, queryClient: QueryClient) {
  setToken(token);
  void queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
}

export function signOut(queryClient: QueryClient) {
  clearToken();
  queryClient.removeQueries({
    predicate: (query) =>
      query.queryKey[0] === "auth" || query.meta?.auth === true,
  });
}
