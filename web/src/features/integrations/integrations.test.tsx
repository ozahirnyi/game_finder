import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProfileScreen } from "./ProfileScreen";
import { PsnScreen } from "./PsnScreen";
import { SteamScreen } from "./SteamScreen";
import PsnPage from "@/app/psn/page";

const api = vi.hoisted(() => ({
  confirmPsnImport: vi.fn(),
  getCurrentUser: vi.fn(),
  getGoogleStatus: vi.fn(),
  getSteamAccount: vi.fn(),
  getSteamLibrary: vi.fn(),
  getSteamLoginUrl: vi.fn(),
  getSteamRecommendations: vi.fn(),
  getSteamSocial: vi.fn(),
  getTelegramAccount: vi.fn(),
  getTelegramLinkUrl: vi.fn(),
  isAuthenticated: vi.fn(),
  previewPsnImport: vi.fn(),
  sendTelegramTestAlert: vi.fn(),
  unlinkTelegramAccount: vi.fn(),
}));

vi.mock("@/lib/api", () => api);

function mockAuth(authenticated: boolean) {
  api.isAuthenticated.mockReturnValue(authenticated);
}

describe("integration screens", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth(true);
    api.getCurrentUser.mockResolvedValue({ id: "user-1", email: "player@example.com", created_at: "2026-01-01", google_linked: false });
    api.getGoogleStatus.mockResolvedValue({ configured: true });
    api.getTelegramAccount.mockResolvedValue({ linked: false, configured: true, username: null, linked_at: null });
    api.getSteamAccount.mockResolvedValue({ linked: false, steam_id: null, persona_name: null, avatar: null, country_code: null, linked_at: null });
    api.getSteamLoginUrl.mockResolvedValue({ url: "https://steam.example/connect" });
    api.getSteamLibrary.mockResolvedValue({ steam: { linked: true, steam_id: "1", persona_name: "Ada", avatar: null, country_code: null, linked_at: null }, games: [] });
    api.getSteamSocial.mockResolvedValue({ steam: { linked: true, steam_id: "1", persona_name: "Ada", avatar: null, country_code: null, linked_at: null }, friends: [], top_friend_games: [], public_libraries: 0, private_libraries: 0 });
  });

  it("shows a sign-in state without requesting Steam data", () => {
    mockAuth(false);
    render(<SteamScreen />);
    expect(api.getSteamLibrary).not.toHaveBeenCalled();
    expect(screen.getByText("Sign in to connect Steam")).toBeVisible();
  });

  it("uses the API-provided Telegram link URL", async () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    api.getTelegramLinkUrl.mockResolvedValue({ configured: true, url: "https://t.me/example", message: null });
    render(<ProfileScreen />);
    fireEvent.click(await screen.findByRole("button", { name: "Connect Telegram" }));
    await waitFor(() => expect(open).toHaveBeenCalled());
    expect(open).toHaveBeenCalledWith("https://t.me/example", "_blank", "noopener,noreferrer");
  });

  it("previews a PSN file then clears the preview after importing", async () => {
    api.previewPsnImport.mockResolvedValue({ games: ["Bloodborne"], total: 1, message: "One game found" });
    api.confirmPsnImport.mockResolvedValue({ created: 1, updated: 0, skipped: 0, total: 1 });
    render(<PsnScreen />);
    fireEvent.change(screen.getByLabelText("Choose PSN export"), { target: { files: [new File(["sheet"], "games.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })] } });
    expect(await screen.findByText("Bloodborne")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Import 1 game" }));
    await waitFor(() => expect(api.confirmPsnImport).toHaveBeenCalledWith(["Bloodborne"]));
    expect(screen.queryByText("Bloodborne")).not.toBeInTheDocument();
    expect(screen.getByText("PlayStation import complete: 1 added, 0 updated, 0 already in your library.")).toBeVisible();
  });

  it("mounts the PSN screen at the PSN route instead of the available-soon placeholder", () => {
    mockAuth(false);
    render(<PsnPage />);
    expect(screen.getByText("Sign in to import PlayStation games")).toBeVisible();
    expect(screen.queryByText("PlayStation Network imports will be available here soon.")).not.toBeInTheDocument();
  });

  it("renders returned Steam games and recommendations", async () => {
    api.getSteamAccount.mockResolvedValue({ linked: true, steam_id: "1", persona_name: "Ada", avatar: null, country_code: null, linked_at: null });
    api.getSteamLibrary.mockResolvedValue({ steam: { linked: true, steam_id: "1", persona_name: "Ada", avatar: null, country_code: null, linked_at: null }, games: [{ appid: 10, name: "Half-Life", playtime_forever: 120, playtime_2weeks: 0, img_icon_url: null }] });
    api.getSteamRecommendations.mockResolvedValue({ recommendations: [{ title: "Portal", reason: "Puzzle favorite", tags: ["Puzzle"] }] });
    render(<SteamScreen />);
    expect(await screen.findByText("Half-Life")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Get recommendations" }));
    expect(await screen.findByText("Portal")).toBeVisible();
  });

  it("renders Steam social data returned by the API", async () => {
    api.getSteamAccount.mockResolvedValue({ linked: true, steam_id: "1", persona_name: "Ada", avatar: null, country_code: null, linked_at: null });
    api.getSteamSocial.mockResolvedValue({ steam: { linked: true, steam_id: "1", persona_name: "Ada", avatar: null, country_code: null, linked_at: null }, friends: [], top_friend_games: [{ appid: 20, name: "Deep Rock Galactic", friends: 3, total_playtime_forever: 600, img_icon_url: null }], public_libraries: 3, private_libraries: 1 });
    render(<SteamScreen />);
    expect(await screen.findByText("Deep Rock Galactic")).toBeVisible();
    expect(screen.getByText("3 public friend libraries available.")).toBeVisible();
  });

  it("keeps the linked Steam library visible when social data fails and retries only social data", async () => {
    api.getSteamAccount.mockResolvedValue({ linked: true, steam_id: "1", persona_name: "Ada", avatar: null, country_code: null, linked_at: null });
    api.getSteamLibrary.mockResolvedValue({ steam: { linked: true, steam_id: "1", persona_name: "Ada", avatar: null, country_code: null, linked_at: null }, games: [{ appid: 10, name: "Half-Life", playtime_forever: 120, playtime_2weeks: 0, img_icon_url: null }] });
    api.getSteamSocial.mockRejectedValueOnce(new Error("Friends service unavailable")).mockResolvedValueOnce({ steam: { linked: true, steam_id: "1", persona_name: "Ada", avatar: null, country_code: null, linked_at: null }, friends: [], top_friend_games: [{ appid: 20, name: "Deep Rock Galactic", friends: 3, total_playtime_forever: 600, img_icon_url: null }], public_libraries: 3, private_libraries: 0 });

    render(<SteamScreen />);

    expect(await screen.findByText("Half-Life")).toBeVisible();
    expect(screen.getByText("Friends' games are unavailable")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Retry friends' games" }));
    expect(await screen.findByText("Deep Rock Galactic")).toBeVisible();
    expect(screen.getByText("Half-Life")).toBeVisible();
  });

  it("keeps Steam library and social data visible when recommendations fail and retries recommendations", async () => {
    api.getSteamAccount.mockResolvedValue({ linked: true, steam_id: "1", persona_name: "Ada", avatar: null, country_code: null, linked_at: null });
    api.getSteamLibrary.mockResolvedValue({ steam: { linked: true, steam_id: "1", persona_name: "Ada", avatar: null, country_code: null, linked_at: null }, games: [{ appid: 10, name: "Half-Life", playtime_forever: 120, playtime_2weeks: 0, img_icon_url: null }] });
    api.getSteamSocial.mockResolvedValue({ steam: { linked: true, steam_id: "1", persona_name: "Ada", avatar: null, country_code: null, linked_at: null }, friends: [], top_friend_games: [{ appid: 20, name: "Deep Rock Galactic", friends: 3, total_playtime_forever: 600, img_icon_url: null }], public_libraries: 3, private_libraries: 0 });
    api.getSteamRecommendations.mockRejectedValueOnce(new Error("Recommendations unavailable")).mockResolvedValueOnce({ recommendations: [{ title: "Portal", reason: "Puzzle favorite", tags: ["Puzzle"] }] });

    render(<SteamScreen />);

    expect(await screen.findByText("Half-Life")).toBeVisible();
    expect(screen.getByText("Deep Rock Galactic")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Get recommendations" }));
    expect(await screen.findByText("Recommendations are unavailable")).toBeVisible();
    expect(screen.getByText("Half-Life")).toBeVisible();
    expect(screen.getByText("Deep Rock Galactic")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Retry recommendations" }));
    expect(await screen.findByText("Portal")).toBeVisible();
  });

  it("keeps the core profile visible when optional integration regions fail and retries each region", async () => {
    api.getGoogleStatus.mockRejectedValueOnce(new Error("Google unavailable")).mockResolvedValueOnce({ configured: true });
    api.getTelegramAccount.mockRejectedValueOnce(new Error("Telegram unavailable")).mockResolvedValueOnce({ linked: false, configured: true, username: null, linked_at: null });

    render(<ProfileScreen />);

    expect(await screen.findByRole("heading", { name: "player@example.com" })).toBeVisible();
    expect(screen.getByText("Google is unavailable")).toBeVisible();
    expect(screen.getByText("Telegram alerts are unavailable")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Retry Google" }));
    fireEvent.click(screen.getByRole("button", { name: "Retry Telegram" }));
    await waitFor(() => expect(api.getGoogleStatus).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(api.getTelegramAccount).toHaveBeenCalledTimes(2));
    expect(screen.queryByText("Google is unavailable")).not.toBeInTheDocument();
    expect(screen.queryByText("Telegram alerts are unavailable")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "player@example.com" })).toBeVisible();
  });
});
