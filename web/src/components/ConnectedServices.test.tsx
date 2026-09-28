import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({
  getProfile: vi.fn(),
  getOnboardingSummary: vi.fn(),
  getSteamAccount: vi.fn(),
  syncSteamLibrary: vi.fn(),
  getTelegramAccount: vi.fn(),
  getTelegramLinkUrl: vi.fn(),
  unlinkGoogleAccount: vi.fn(),
}));
vi.mock("@/lib/api", async () => ({ ...(await vi.importActual("@/lib/api")), ...api }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));
import { ConnectedServices } from "./ConnectedServices";
afterEach(cleanup);
it("does not show false disconnected states while loading services", () => {
  for (const fn of Object.values(api)) fn.mockReturnValue(new Promise(() => {}));
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ConnectedServices />
    </QueryClientProvider>,
  );
  expect(screen.queryByText("Not connected")).not.toBeInTheDocument();
  expect(screen.queryByText("Telegram bot is not configured")).not.toBeInTheDocument();
});
it("shows linked Google and imported PlayStation data", async () => {
  api.getProfile.mockResolvedValue({ google_linked: true });
  api.getOnboardingSummary.mockResolvedValue({ psn_library_games: 178 });
  api.getSteamAccount.mockResolvedValue({ linked: false });
  api.getTelegramAccount.mockResolvedValue({ configured: true, linked: true });
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ConnectedServices />
    </QueryClientProvider>,
  );
  expect(await screen.findByText("178 imported games")).toBeInTheDocument();
  expect(screen.getByText("Google sign-in connected")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Disconnect Google" })).toBeInTheDocument();
});

it("shows a Steam linking error returned by the callback", async () => {
  window.history.replaceState({}, "", "/account?steam_error=This+Steam+account+is+already+linked");
  api.getProfile.mockResolvedValue({ google_linked: false });
  api.getOnboardingSummary.mockResolvedValue({ psn_library_games: 0 });
  api.getSteamAccount.mockResolvedValue({ linked: false });
  api.getTelegramAccount.mockResolvedValue({ configured: true, linked: false });
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ConnectedServices />
    </QueryClientProvider>,
  );
  expect(await screen.findByText("This Steam account is already linked")).toBeInTheDocument();
});

it("refreshes the cached library pages after Sync now", async () => {
  api.getProfile.mockResolvedValue({ google_linked: false });
  api.getOnboardingSummary.mockResolvedValue({ psn_library_games: 0 });
  api.getSteamAccount.mockResolvedValue({ linked: true });
  api.getTelegramAccount.mockResolvedValue({ configured: true, linked: false });
  api.syncSteamLibrary.mockResolvedValue({ games: [], removed: 0 });
  const client = new QueryClient();
  const invalidate = vi.spyOn(client, "invalidateQueries");

  render(
    <QueryClientProvider client={client}>
      <ConnectedServices />
    </QueryClientProvider>,
  );
  fireEvent.click(await screen.findByRole("button", { name: /sync now/i }));

  await waitFor(() =>
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["library-overview-page"] }),
  );
});

it("opens Telegram from a click-activated tab after requesting the link", async () => {
  api.getProfile.mockResolvedValue({ google_linked: false });
  api.getOnboardingSummary.mockResolvedValue({ psn_library_games: 0 });
  api.getSteamAccount.mockResolvedValue({ linked: false });
  api.getTelegramAccount.mockResolvedValue({ configured: true, linked: false });
  const telegramTab = Object.assign(new EventTarget(), {
    location: { href: "about:blank" },
    closed: false,
  }) as unknown as Window;
  const open = vi.spyOn(window, "open").mockReturnValue(telegramTab);
  api.getTelegramLinkUrl.mockImplementation(() => {
    expect(open).toHaveBeenCalledWith("about:blank", "_blank");
    return Promise.resolve({
      configured: true,
      url: "https://t.me/playfinder_alerts_bot?start=one-time-token",
    });
  });

  render(
    <QueryClientProvider client={new QueryClient()}>
      <ConnectedServices />
    </QueryClientProvider>,
  );
  fireEvent.click(await screen.findByRole("button", { name: "Connect Telegram" }));

  await waitFor(() => {
    expect(telegramTab.location.href).toBe(
      "tg://resolve?domain=playfinder_alerts_bot&start=one-time-token",
    );
  });
});
