import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { ActiveAuthScreen } from "@/features/auth/ActiveAuthScreen";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [{ title: "Sign in — GameFinder" }],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();

  return (
    <AppShell>
      <ActiveAuthScreen onSuccess={() => navigate({ to: "/search" })} />
    </AppShell>
  );
}
