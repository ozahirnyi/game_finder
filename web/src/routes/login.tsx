import { createFileRoute } from "@tanstack/react-router";
import { AuthPanel } from "@/features/auth/AuthPanel";

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>) => ({ message: typeof search.message === "string" ? search.message : "" }),
  component: LoginRoute,
});

function LoginRoute() {
  const { message } = Route.useSearch();
  return <AuthPanel mode="login" notice={message} />;
}
