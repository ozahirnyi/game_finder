import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { WishlistScreen } from "./WishlistScreen";
import {
  deleteWishlistItem,
  getTelegramAccount,
  listPriceAlerts,
  listWishlist,
} from "@/lib/api";

vi.mock("@/lib/api", () => ({
  listWishlist: vi.fn(),
  deleteWishlistItem: vi.fn(),
  listPriceAlerts: vi.fn(),
  getTelegramAccount: vi.fn(),
}));
vi.mock("./AlertControls", () => ({
  AlertControls: ({ title }: { title: string }) => (
    <div>Alerts for {title}</div>
  ),
}));

describe("WishlistScreen", () => {
  it("renders only owner wishlist data and removes an item", async () => {
    vi.mocked(listWishlist).mockResolvedValue([
      {
        id: "w1",
        identity_kind: "rawg",
        identity_value: "30",
        title: "Hades",
        created_at: "",
        updated_at: "",
      },
    ]);
    vi.mocked(listPriceAlerts).mockResolvedValue([]);
    vi.mocked(getTelegramAccount).mockResolvedValue({
      linked: false,
      configured: false,
      username: null,
      linked_at: null,
    });
    vi.mocked(deleteWishlistItem).mockResolvedValue(undefined);
    render(<WishlistScreen />);
    expect(await screen.findByText("Hades")).toBeVisible();
    expect(screen.queryByText("Baldur's Gate 3")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remove Hades" }));
    await waitFor(() => expect(deleteWishlistItem).toHaveBeenCalledWith("w1"));
  });

  it("offers retry after loading fails and links the empty state to search", async () => {
    vi.mocked(listWishlist)
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce([]);
    vi.mocked(listPriceAlerts).mockResolvedValue([]);
    vi.mocked(getTelegramAccount).mockResolvedValue({
      linked: false,
      configured: false,
      username: null,
      linked_at: null,
    });
    render(<WishlistScreen />);
    fireEvent.click(await screen.findByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Your wishlist is empty.")).toBeVisible();
    expect(screen.getByRole("link", { name: "Search games" })).toHaveAttribute(
      "href",
      "/search",
    );
  });
});
