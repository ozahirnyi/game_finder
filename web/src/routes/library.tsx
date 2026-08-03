import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { LibraryScreen } from "@/features/library/LibraryScreen";
export const Route = createFileRoute("/library")({ component: Page });
function Page() { return <AppShell><LibraryScreen /></AppShell>; }
