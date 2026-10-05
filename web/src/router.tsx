import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { getToken, subscribeToAuthChanges } from "./lib/api";

export const getRouter = () => {
  const queryClient = new QueryClient();
  if (typeof window !== "undefined") {
    let cacheToken = getToken();
    subscribeToAuthChanges(() => {
      const nextToken = getToken();
      if (nextToken === cacheToken) return;
      // Removing queries cancels their work and keeps late responses out of the next session.
      queryClient.clear();
      cacheToken = nextToken;
    });
  }

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
