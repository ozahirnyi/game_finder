import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { ProfileScreen } from "@/features/integrations/ProfileScreen";
export const Route = createFileRoute("/profile")({ component: Page });
function Page() { return <AppShell><ProfileScreen /></AppShell>; }
