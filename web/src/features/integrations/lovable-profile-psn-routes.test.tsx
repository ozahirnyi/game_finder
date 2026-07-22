import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Route as ProfileRoute } from "@/routes/profile";
import { Route as PsnRoute } from "@/routes/psn";

const api = vi.hoisted(() => ({
  confirmPsnImport: vi.fn(),
  getCurrentUser: vi.fn(),
  getGoogleLinkUrl: vi.fn(),
  getGoogleStatus: vi.fn(),
  getTelegramAccount: vi.fn(),
  getTelegramLinkUrl: vi.fn(),
  previewPsnImport: vi.fn(),
  sendTelegramTestAlert: vi.fn(),
  unlinkTelegramAccount: vi.fn(),
}));

vi.mock("@/lib/api", () => api);
vi.mock("@/components/AppShell", () => ({
  AppShell: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

describe("Lovable profile and PSN routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getCurrentUser.mockResolvedValue({
      id: "user-1",
      email: "player@example.com",
      created_at: "2026-01-01",
      google_linked: false,
    });
    api.getGoogleStatus.mockResolvedValue({ configured: true });
    api.getTelegramAccount.mockResolvedValue({
      linked: false,
      configured: true,
      username: null,
      linked_at: null,
    });
  });

  it("keeps the profile cards while using account data and unavailable placeholders", async () => {
    render(<ProfileRoute.options.component />);

    expect(
      await screen.findByRole("heading", { name: "player@example.com" }),
    ).toBeVisible();
    expect(
      screen.getAllByText("Data unavailable").length,
    ).toBeGreaterThanOrEqual(6);
    expect(screen.getByText("Google")).toBeVisible();
    expect(screen.getAllByRole("button", { name: "Connect" })).toHaveLength(4);
  });

  it("retries only failed Google and Telegram regions", async () => {
    api.getGoogleStatus
      .mockRejectedValueOnce(new Error("Google unavailable"))
      .mockResolvedValueOnce({ configured: true });
    api.getTelegramAccount
      .mockRejectedValueOnce(new Error("Telegram unavailable"))
      .mockResolvedValueOnce({
        linked: false,
        configured: true,
        username: null,
        linked_at: null,
      });
    render(<ProfileRoute.options.component />);

    expect(await screen.findByText("Google unavailable")).toBeVisible();
    expect(screen.getByText("Telegram unavailable")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Retry Google" }));
    fireEvent.click(screen.getByRole("button", { name: "Retry Telegram" }));
    await waitFor(() => expect(api.getGoogleStatus).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(api.getTelegramAccount).toHaveBeenCalledTimes(2),
    );
    expect(screen.getByText("Google")).toBeVisible();
    expect(screen.getByText("Telegram")).toBeVisible();
  });

  it("shows a retry when loading the current user fails", async () => {
    api.getCurrentUser
      .mockRejectedValueOnce(new Error("Profile unavailable"))
      .mockResolvedValueOnce({
        id: "user-1",
        email: "player@example.com",
        created_at: "2026-01-01",
        google_linked: false,
      });
    render(<ProfileRoute.options.component />);

    expect(await screen.findByText("Profile unavailable")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Retry profile" }));
    await waitFor(() => expect(api.getCurrentUser).toHaveBeenCalledTimes(2));
    expect(
      await screen.findByRole("heading", { name: "player@example.com" }),
    ).toBeVisible();
  });

  it("retries the failed Google and Telegram link actions", async () => {
    api.getGoogleLinkUrl
      .mockRejectedValueOnce(new Error("Google link unavailable"))
      .mockResolvedValueOnce({ url: "https://google.example/link" });
    api.getTelegramLinkUrl
      .mockRejectedValueOnce(new Error("Telegram link unavailable"))
      .mockResolvedValueOnce({
        configured: true,
        url: "https://t.me/example",
        message: null,
      });
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    render(<ProfileRoute.options.component />);

    const googleRow = (await screen.findByText("Google")).parentElement
      ?.parentElement;
    const telegramRow =
      screen.getByText("Telegram").parentElement?.parentElement;
    if (!googleRow || !telegramRow) {
      throw new Error("Expected Google and Telegram integration rows");
    }
    fireEvent.click(within(googleRow).getByRole("button"));
    expect(await screen.findByText("Google link unavailable")).toBeVisible();
    fireEvent.click(within(telegramRow).getByRole("button"));
    expect(await screen.findByText("Telegram link unavailable")).toBeVisible();
    fireEvent.click(
      within(googleRow).getByRole("button", { name: "Retry Google" }),
    );
    await waitFor(() => expect(api.getGoogleLinkUrl).toHaveBeenCalledTimes(2));
    fireEvent.click(
      within(telegramRow).getByRole("button", { name: "Retry Telegram" }),
    );
    await waitFor(() =>
      expect(api.getTelegramLinkUrl).toHaveBeenCalledTimes(2),
    );
    expect(open).toHaveBeenCalledWith(
      "https://t.me/example",
      "_blank",
      "noopener,noreferrer",
    );
  });

  it("previews then confirms the selected PSN export", async () => {
    api.previewPsnImport.mockResolvedValue({
      games: ["Bloodborne"],
      total: 1,
      message: "One game found",
    });
    api.confirmPsnImport.mockResolvedValue({
      created: 1,
      updated: 0,
      skipped: 0,
      total: 1,
    });
    render(<PsnRoute.options.component />);

    fireEvent.change(screen.getByLabelText("Choose PSN export"), {
      target: {
        files: [
          new File(["sheet"], "games.xlsx", {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          }),
        ],
      },
    });
    expect(await screen.findByText("Bloodborne")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Sync now" }));
    await waitFor(() =>
      expect(api.confirmPsnImport).toHaveBeenCalledWith(["Bloodborne"]),
    );
    expect(
      screen.getByText(
        "PlayStation import complete: 1 added, 0 updated, 0 already in your library.",
      ),
    ).toBeVisible();
  });

  it("retries a failed PSN preview with the already-selected file", async () => {
    const file = new File(["sheet"], "games.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    api.previewPsnImport
      .mockRejectedValueOnce(new Error("Preview unavailable"))
      .mockResolvedValueOnce({
        games: ["Bloodborne"],
        total: 1,
        message: null,
      });
    render(<PsnRoute.options.component />);

    fireEvent.change(screen.getByLabelText("Choose PSN export"), {
      target: { files: [file] },
    });
    expect(await screen.findByText("Preview unavailable")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Retry import" }));
    await waitFor(() => expect(api.previewPsnImport).toHaveBeenCalledTimes(2));
    expect(api.previewPsnImport).toHaveBeenLastCalledWith(file);
    expect(await screen.findByText("Bloodborne")).toBeVisible();
  });

  it("renders unavailable placeholders for unsupported PSN account data", () => {
    render(<PsnRoute.options.component />);

    expect(
      screen.getAllByText("Data unavailable").length,
    ).toBeGreaterThanOrEqual(10);
    expect(screen.queryByText("alex_v_ps")).not.toBeInTheDocument();
    expect(screen.queryByText("Marcus V.")).not.toBeInTheDocument();
  });
});
