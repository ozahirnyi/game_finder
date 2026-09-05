import { createFileRoute } from "@tanstack/react-router";
import { AuthPanel } from "@/features/auth/AuthPanel";

export const Route = createFileRoute("/register")({
  component: () => <AuthPanel mode="register" />,
});
