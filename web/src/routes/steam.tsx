import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/steam")({
  validateSearch: (search: Record<string, unknown>) => ({
    linked: search.linked === "1" ? "1" : undefined,
    error: typeof search.error === "string" ? search.error : undefined,
  }),
  beforeLoad: ({ search }) => {
    throw redirect({
      to: "/library",
      search: { tab: "steam", ...search },
      replace: true,
    });
  },
});
