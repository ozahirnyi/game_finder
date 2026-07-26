import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/psn")({
  beforeLoad: () => {
    throw redirect({
      to: "/library",
      search: { tab: "psn" },
      replace: true,
    });
  },
});
