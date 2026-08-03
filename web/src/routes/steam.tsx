import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { SteamScreen } from "@/features/integrations/SteamScreen";
export const Route = createFileRoute("/steam")({ component: Page });
function Page() { return <AppShell><SteamScreen /></AppShell>; }
