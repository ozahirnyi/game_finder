import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { DealsScreen } from "@/features/discovery/DealsScreen";
export const Route = createFileRoute("/deals")({ component: Page });
function Page() { return <AppShell><DealsScreen /></AppShell>; }
