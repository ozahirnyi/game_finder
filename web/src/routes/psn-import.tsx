import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { PsnImportFlow } from "../components/PsnImportFlow";

export { PsnImportFlow } from "../components/PsnImportFlow";

export const Route = createFileRoute("/psn-import")({ component: PsnImportPage });

function PsnImportPage() {
  return (
    <AppShell>
      <PsnImportFlow />
    </AppShell>
  );
}
