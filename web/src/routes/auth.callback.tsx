import { createFileRoute } from "@tanstack/react-router";
import { OAuthCallback } from "@/app/auth/callback/page";

export const Route = createFileRoute("/auth/callback")({
  component: OAuthCallback,
});
