import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PsnImportPanel } from "./PsnImportPanel";

const api = vi.hoisted(() => ({
  confirmPsnImport: vi.fn(),
  previewPsnImport: vi.fn(),
}));

vi.mock("@/lib/api", () => api);

describe("PsnImportPanel", () => {
  beforeEach(() => vi.clearAllMocks());

  it("previews an XLSX upload and confirms selected games", async () => {
    api.previewPsnImport.mockResolvedValue({
      games: ["Bloodborne", "Returnal"],
      total: 2,
      message: null,
    });
    api.confirmPsnImport.mockResolvedValue({ created: 1, updated: 0, skipped: 1, total: 1 });

    render(<PsnImportPanel />);

    fireEvent.change(screen.getByLabelText("Choose PSN Excel export"), {
      target: { files: [new File(["sheet"], "psn.xlsx")] },
    });

    expect(await screen.findByText("Bloodborne")).toBeVisible();
    fireEvent.click(screen.getByLabelText("Returnal"));
    fireEvent.click(screen.getByRole("button", { name: "Import 1 game" }));

    await waitFor(() => expect(api.confirmPsnImport).toHaveBeenCalledWith(["Bloodborne"]));
    expect(screen.getByText("1 added, 0 updated, 1 already in your library.")).toBeVisible();
  });

  it("shows the no-game-data response without calling confirm", async () => {
    api.previewPsnImport.mockRejectedValue(
      new Error(
        "This PSN export was read successfully, but it contains no game activity or game purchases to import."
      )
    );

    render(<PsnImportPanel />);

    fireEvent.change(screen.getByLabelText("Choose PSN Excel export"), {
      target: { files: [new File(["sheet"], "psn.xlsx")] },
    });

    expect(await screen.findByText(/contains no game activity or game purchases/i)).toBeVisible();
    expect(api.confirmPsnImport).not.toHaveBeenCalled();
  });
});
