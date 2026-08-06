import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AlertControls } from "./AlertControls";
import { createPriceAlert, deletePriceAlert } from "@/lib/api";

vi.mock("@/lib/api", () => ({
  createPriceAlert: vi.fn(),
  deletePriceAlert: vi.fn(),
}));

describe("AlertControls", () => {
  it("creates a target-discount alert with the selected channel", async () => {
    vi.mocked(createPriceAlert).mockResolvedValue({} as never);
    render(
      <AlertControls
        identity={{ kind: "rawg", value: "30" }}
        title="Hades"
        alerts={[]}
        telegram={{ linked: true, configured: true }}
      />,
    );
    fireEvent.click(screen.getByLabelText("Target discount"));
    fireEvent.change(screen.getByLabelText("Discount percentage"), {
      target: { value: "35" },
    });
    fireEvent.click(screen.getByLabelText("Telegram"));
    fireEvent.click(screen.getByRole("button", { name: "Create alert" }));
    await waitFor(() =>
      expect(createPriceAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: "target_discount",
          threshold: 35,
          telegram: true,
          in_app: true,
        }),
      ),
    );
  });

  it("shows the duplicate response and deletes existing alerts", async () => {
    vi.mocked(createPriceAlert).mockRejectedValue({
      detail: "You already have this price alert.",
    });
    vi.mocked(deletePriceAlert).mockResolvedValue(undefined);
    render(
      <AlertControls
        identity={{ kind: "rawg", value: "30" }}
        title="Hades"
        alerts={[
          {
            id: "a1",
            identity_kind: "rawg",
            identity_value: "30",
            title: "Hades",
            mode: "any_discount",
            threshold: null,
            in_app: true,
            telegram: false,
            created_at: "",
            updated_at: "",
          },
        ]}
        telegram={{ linked: false, configured: false }}
      />,
    );
    expect(screen.getAllByText("Any discount")[0]).toBeVisible();
    expect(screen.getByText("Connect Telegram in Profile")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Create alert" }));
    expect(
      await screen.findByText("You already have this price alert."),
    ).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Delete alert" }));
    await waitFor(() => expect(deletePriceAlert).toHaveBeenCalledWith("a1"));
  });

  it("explains unsupported Steam identities", () => {
    render(
      <AlertControls
        identity={{ kind: "steam", value: "1" }}
        title="Steam title"
        alerts={[]}
        telegram={{ linked: false, configured: false }}
        supported={false}
      />,
    );
    expect(
      screen.getByText("Price alerts are not available for this Steam game."),
    ).toBeVisible();
  });
});
