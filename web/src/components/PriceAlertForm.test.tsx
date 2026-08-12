import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ getTelegramAccount: vi.fn() }));
vi.mock("@/lib/api", () => api);

import { PriceAlertForm } from "./PriceAlertForm";

function renderForm(onSubmit: (data: unknown) => void) {
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <PriceAlertForm wishlistCatalogGameId={274755} onSubmit={onSubmit} />
    </QueryClientProvider>,
  );
}

describe("PriceAlertForm", () => {
  const onSubmit = vi.fn();

  beforeEach(() => {
    onSubmit.mockReset();
    api.getTelegramAccount.mockResolvedValue({ linked: false, configured: false });
  });
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("submits any discount as the existing one-percent contract", async () => {
    renderForm(onSubmit);

    fireEvent.click(screen.getByRole("button", { name: "Save alert" }));

    expect(onSubmit).toHaveBeenCalledWith({
      wishlist_catalog_game_id: 274755,
      target_discount: 1,
      delivery_channels: ["in_app"],
    });
  });

  it("submits target price and target discount presets without inactive fields", () => {
    renderForm(onSubmit);

    fireEvent.click(screen.getByLabelText("Target price"));
    fireEvent.change(screen.getByLabelText("Price"), { target: { value: "19.99" } });
    fireEvent.click(screen.getByRole("button", { name: "Save alert" }));
    expect(onSubmit).toHaveBeenLastCalledWith({
      wishlist_catalog_game_id: 274755,
      target_price: 19.99,
      delivery_channels: ["in_app"],
    });

    fireEvent.click(screen.getByLabelText("Target discount"));
    fireEvent.change(screen.getByLabelText("Discount"), { target: { value: "40" } });
    fireEvent.click(screen.getByRole("button", { name: "Save alert" }));
    expect(onSubmit).toHaveBeenLastCalledWith({
      wishlist_catalog_game_id: 274755,
      target_discount: 40,
      delivery_channels: ["in_app"],
    });
  });

  it("allows Telegram only when the account is both configured and linked", async () => {
    api.getTelegramAccount.mockResolvedValue({ linked: true, configured: true });
    renderForm(onSubmit);

    const telegram = await screen.findByRole("checkbox", { name: "Telegram" });
    await waitFor(() => expect(telegram).toBeEnabled());
    fireEvent.click(telegram);
    fireEvent.click(screen.getByRole("button", { name: "Save alert" }));
    expect(onSubmit).toHaveBeenCalledWith({
      wishlist_catalog_game_id: 274755,
      target_discount: 1,
      delivery_channels: ["in_app", "telegram"],
    });
  });

  it("explains unavailable Telegram delivery and links to account connection", async () => {
    api.getTelegramAccount.mockResolvedValue({ linked: false, configured: true });
    renderForm(onSubmit);

    expect(
      await screen.findByText("Connect Telegram to enable Telegram delivery."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Connect Telegram" })).toHaveAttribute(
      "href",
      "/account",
    );
    expect(screen.getByRole("checkbox", { name: "Telegram" })).toBeDisabled();
  });
});
