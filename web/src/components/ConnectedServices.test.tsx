import { cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({
  getProfile: vi.fn(),
  getOnboardingSummary: vi.fn(),
  getSteamAccount: vi.fn(),
  getTelegramAccount: vi.fn(),
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
});
