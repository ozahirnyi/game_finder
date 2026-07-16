import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LibraryScreen } from "./LibraryScreen";
import { SavedGameDetailScreen } from "./SavedGameDetailScreen";
import { WishlistScreen } from "./WishlistScreen";
import { deleteSavedGame, getSavedGame, isAuthenticated, listSavedGames, updateSavedGame } from "@/lib/api";

vi.mock("@/lib/api", () => ({
  deleteSavedGame: vi.fn(),
  getSavedGame: vi.fn(),
  isAuthenticated: vi.fn(),
  listSavedGames: vi.fn(),
  updateSavedGame: vi.fn(),
}));

const hades = {
  id: "g1",
  title: "Hades II",
  notes: null,
  info: null,
  source: "manual" as const,
  external_id: null,
  playtime_forever: null,
  playtime_2weeks: null,
  img_icon_url: null,
  synced_at: null,
  created_at: "2026-01-01",
};

function mockAuth(value: boolean) {
  vi.mocked(isAuthenticated).mockReturnValue(value);
}

describe("LibraryScreen", () => {
  beforeEach(() => {
    mockAuth(true);
  });

  it("does not call listSavedGames before login", () => {
    mockAuth(false);

    render(<LibraryScreen />);

    expect(listSavedGames).not.toHaveBeenCalled();
    expect(screen.getByText("Sign in to view your library")).toBeVisible();
  });

  it("removes the deleted game after the API confirms deletion", async () => {
    vi.mocked(listSavedGames).mockResolvedValue([hades]);
    vi.mocked(deleteSavedGame).mockResolvedValue(undefined);

    render(<LibraryScreen />);

    fireEvent.click(await screen.findByRole("button", { name: "Remove Hades II" }));

    await waitFor(() => expect(screen.queryByText("Hades II")).not.toBeInTheDocument());
  });

  it("keeps a game visible and reports an inline error when deletion fails", async () => {
    vi.mocked(listSavedGames).mockResolvedValue([hades]);
    vi.mocked(deleteSavedGame).mockRejectedValue(new Error("Network unavailable"));

    render(<LibraryScreen />);

    fireEvent.click(await screen.findByRole("button", { name: "Remove Hades II" }));

    expect(await screen.findByText("Network unavailable")).toBeVisible();
    expect(screen.getByText("Hades II")).toBeVisible();
  });
});

describe("SavedGameDetailScreen", () => {
  it("keeps the current note visible and reports an inline error when an update fails", async () => {
    mockAuth(true);
    vi.mocked(getSavedGame).mockResolvedValue({ ...hades, notes: "First run" });
    vi.mocked(updateSavedGame).mockRejectedValue(new Error("Could not save"));

    render(<SavedGameDetailScreen id="g1" />);

    const notes = await screen.findByLabelText("Notes");
    fireEvent.change(notes, { target: { value: "Second run" } });
    fireEvent.click(screen.getByRole("button", { name: "Save notes" }));

    expect(await screen.findByText("Could not save")).toBeVisible();
    expect(screen.getByDisplayValue("Second run")).toBeVisible();
  });
});

describe("WishlistScreen", () => {
  it("only shows saved games marked with the wishlist keyword in notes", async () => {
    mockAuth(true);
    vi.mocked(listSavedGames).mockResolvedValue([
      hades,
      { ...hades, id: "g2", title: "Silksong", notes: "Wishlist: play on release" },
    ]);

    render(<WishlistScreen />);

    expect(await screen.findByText("Silksong")).toBeVisible();
    expect(screen.queryByText("Hades II")).not.toBeInTheDocument();
    expect(screen.getByText(/saved games marked with a “wishlist” keyword/i)).toBeVisible();
  });
});
