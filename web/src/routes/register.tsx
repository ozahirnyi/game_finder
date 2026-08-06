import { createFileRoute } from "@tanstack/react-router";
import { AuthScreen } from "@/features/auth/AuthScreen";

export const Route = createFileRoute("/register")({ component: RegisterPage });

function RegisterPage() {
  const navigate = Route.useNavigate();
  const { queryClient } = Route.useRouteContext();
  return (
    <AuthScreen
      mode="register"
      queryClient={queryClient}
      onSuccess={() => navigate({ to: "/" })}
    />
  );
}
