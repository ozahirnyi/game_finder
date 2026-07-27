import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getHomepageDeals } from "@/lib/api";
import { PublicDeals } from "./PublicDeals";

vi.mock("@/lib/api", () => ({ getHomepageDeals: vi.fn() }));

const deal = {
  id: 1,
  name: "Hades II",
  released: null,
  background_image: null,
  url: "https://store.example/hades-2",
  current: {
    shop: "Steam",
    price: { amount: 24.99, currency: "USD" },
    regular: { amount: 29.99, currency: "USD" },
    cut: 17,
    url: "https://store.example/hades-2",
    timestamp: null,
  },
  history_low_all: null,
};

describe("PublicDeals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads public deals without authentication and renders a deal", async () => {
    vi.mocked(getHomepageDeals).mockResolvedValue({ results: [deal] });
    render(<PublicDeals initialCountry="UA" limit={3} />);
    expect(screen.getByLabelText("Loading price drops")).toBeVisible();
    expect(
      await screen.findByRole("heading", { name: "Hades II" }),
    ).toBeVisible();
    expect(screen.getByLabelText("Hades II cover unavailable")).toBeVisible();
    expect(getHomepageDeals).toHaveBeenCalledWith("UA", 3);
  });

  it("retries the detected region once in US after an error", async () => {
    vi.mocked(getHomepageDeals)
      .mockRejectedValueOnce(new Error("UA unavailable"))
      .mockResolvedValueOnce({ results: [deal] });
    render(<PublicDeals initialCountry="UA" limit={3} />);
    expect(
      await screen.findByText(
        "Showing USD prices because local offers are unavailable.",
      ),
    ).toBeVisible();
    expect(getHomepageDeals).toHaveBeenNthCalledWith(2, "US", 3);
  });

  it("shows retry after the US fallback also fails", async () => {
    vi.mocked(getHomepageDeals).mockRejectedValue(new Error("offline"));
    render(<PublicDeals initialCountry="UA" limit={3} />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Retry price drops" }),
    );
    await waitFor(() => expect(getHomepageDeals).toHaveBeenCalledTimes(4));
  });
});
