import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { SectionHeader } from "@/components/ui-bits";
import { PsnImportPanel } from "@/features/integrations/PsnImportPanel";

export const Route = createFileRoute("/psn")({
  head: () => ({
    meta: [
      { title: "Import PlayStation games — GameFinder" },
      {
        name: "description",
        content: "Import game purchases and activity from your PlayStation Data Access Excel export.",
      },
    ],
  }),
  component: PsnPage,
});

function PsnPage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-3xl">
        <SectionHeader
          title="Import PlayStation games"
          hint="Upload the Excel export from PlayStation Account Management. Your original file is not stored."
        />
        <PsnImportPanel />
      </div>
    </AppShell>
  );
}
