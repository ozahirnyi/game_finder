import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { PsnLibraryPanel } from "@/features/library/PsnLibraryPanel";

export const Route = createFileRoute("/psn")({ component: PsnPage });

export function PsnPage() {
  return (
    <AppShell>
      <PsnLibraryPanel />
    </AppShell>
  );
}
