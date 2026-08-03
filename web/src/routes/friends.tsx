import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { FriendsScreen } from "@/features/friends/FriendsScreen";
export const Route = createFileRoute("/friends")({ component: Page });
function Page() { return <AppShell><FriendsScreen /></AppShell>; }
