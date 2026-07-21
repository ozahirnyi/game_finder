import { createFileRoute } from "@tanstack/react-router";
import { AuthScreen } from "@/features/auth/AuthScreen";

export const Route = createFileRoute("/register")({
  component: () => <AuthScreen mode="register" />,
});
