import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { PsnImportFlow } from "./PsnImportFlow";

const { previewPsnImport, confirmPsnImport } = vi.hoisted(() => ({
  previewPsnImport: vi.fn(),
  confirmPsnImport: vi.fn(),
}));

vi.mock("../lib/api", () => ({ previewPsnImport, confirmPsnImport }));

describe("PsnImportFlow", () => {
  it("starts with an export upload action", () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <PsnImportFlow />
      </QueryClientProvider>,
    );

    expect(screen.getByText(/choose an export file/i)).toBeInTheDocument();
  });

  it("selects confirmed games and leaves review items out of the import", async () => {
    previewPsnImport.mockResolvedValueOnce({
      items: [
        { source_title: "God of War", status: "confirmed", igdb_id: 101, title: "God of War" },
        { source_title: "EA Play", status: "review", igdb_id: null, title: null },
      ],
    });
    confirmPsnImport.mockResolvedValueOnce({ created: 1, updated: 0, skipped: 0, total: 1 });
    const { container } = render(
      <QueryClientProvider client={new QueryClient()}>
        <PsnImportFlow />
      </QueryClientProvider>,
    );

    const fileInput = container.querySelector('input[type="file"]')!;
    expect(fileInput).toHaveAttribute("accept", ".xlsx,.csv,.json");
    fireEvent.change(fileInput, { target: { files: [new File(["x"], "export.xlsx")] } });

    await screen.findByText("God of War");
    expect(screen.getByRole("checkbox", { name: "God of War" })).toBeChecked();
    expect(screen.getByText(/EA Play.*not imported/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /import 1 game/i }));
    await waitFor(() => expect(confirmPsnImport.mock.calls[0]?.[0]).toEqual([101]));
  });
});
