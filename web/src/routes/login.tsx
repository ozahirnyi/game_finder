import { createFileRoute } from "@tanstack/react-router";
import { AuthScreen } from "@/features/auth/AuthScreen";

export const Route = createFileRoute("/login")({ component: LoginPage });

function LoginPage() {
  const navigate = Route.useNavigate();
  const { queryClient } = Route.useRouteContext();
  return (
    <AuthScreen
      mode="login"
      queryClient={queryClient}
      onSuccess={() => navigate({ to: "/" })}
    />
  );
}
