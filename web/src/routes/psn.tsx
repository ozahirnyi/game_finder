import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { PsnScreen } from "@/features/integrations/PsnScreen";
export const Route = createFileRoute("/psn")({ component: Page });
function Page() { return <AppShell><PsnScreen /></AppShell>; }
