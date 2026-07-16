import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LibraryPage } from "../routes/library";
import { WishlistPage } from "../routes/wishlist";
import { isAuthenticated, listSavedGames } from "@/lib/api";

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => options,
  Link: ({ children, ...props }: React.ComponentProps<"a">) => (
    <a {...props}>{children}</a>
  ),
}));
vi.mock("@/components/AppShell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => (
    <main>{children}</main>
  ),
}));
vi.mock("@/lib/api", () => ({
  isAuthenticated: vi.fn(),
  listSavedGames: vi.fn(),
}));

const savedGame = {
  id: "saved-1",
  title: "Hades II",
  notes: null,
  info: null,
  source: "steam" as const,
  external_id: "1145350",
  playtime_forever: 125,
  playtime_2weeks: null,
  img_icon_url: null,
  synced_at: null,
  created_at: "2026-07-16T00:00:00Z",
};

function renderScreen(view: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{view}</QueryClientProvider>,
  );
}

describe("Lovable library and wishlist routes", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(isAuthenticated).mockReturnValue(true);
  });

  it("renders the library from saved-game API records and leaves unavailable metadata explicit", async () => {
    vi.mocked(listSavedGames).mockResolvedValue([savedGame]);
    renderScreen(<LibraryPage />);
    expect(await screen.findByText("Hades II")).toBeVisible();
    expect(screen.getByText("2h")).toBeVisible();
    expect(screen.getAllByText("Data unavailable").length).toBeGreaterThan(0);
  });

  it("uses the library container for signed-out state without requesting protected data", () => {
    vi.mocked(isAuthenticated).mockReturnValue(false);
    renderScreen(<LibraryPage />);
    expect(
      screen.getByText("Sign in to view your library", {
        selector: "p.rounded-xl",
      }),
    ).toBeVisible();
    expect(listSavedGames).not.toHaveBeenCalled();
  });

  it("keeps the library count unknown while saved games are loading", () => {
    vi.mocked(listSavedGames).mockReturnValue(new Promise(() => {}));

    renderScreen(<LibraryPage />);

    expect(screen.getByText(/loading library/i)).toBeVisible();
    expect(screen.queryByText(/0 games synced/i)).not.toBeInTheDocument();
  });

  it("keeps the library count unavailable when saved games fail to load", async () => {
    vi.mocked(listSavedGames).mockRejectedValue(new Error("Offline"));

    renderScreen(<LibraryPage />);

    expect(
      await screen.findByText("Data unavailable", {
        selector: "p.mt-1.text-sm.text-muted-foreground",
      }),
    ).toBeVisible();
    expect(screen.queryByText(/0 games synced/i)).not.toBeInTheDocument();
  });

  it("renders only saved games explicitly marked as wishlist items", async () => {
    vi.mocked(listSavedGames).mockResolvedValue([
      savedGame,
      {
        ...savedGame,
        id: "saved-2",
        title: "Silksong",
        notes: "Wishlist: buy on release",
      },
    ]);
    renderScreen(<WishlistPage />);
    expect(await screen.findByText("Silksong")).toBeVisible();
    expect(screen.queryByText("Hades II")).not.toBeInTheDocument();
    expect(
      screen.getByText(
        /wishlist items marked in your saved-game notes or info/i,
      ),
    ).toBeVisible();
  });

  it("does not request wishlist data while signed out", async () => {
    vi.mocked(isAuthenticated).mockReturnValue(false);
    renderScreen(<WishlistPage />);
    await waitFor(() =>
      expect(
        screen.getByText("Sign in to view your wishlist", {
          selector: "div.rounded-2xl",
        }),
      ).toBeVisible(),
    );
    expect(listSavedGames).not.toHaveBeenCalled();
  });

  it("keeps the wishlist count unknown while saved games are loading", () => {
    vi.mocked(listSavedGames).mockReturnValue(new Promise(() => {}));

    renderScreen(<WishlistPage />);

    expect(screen.getByText(/loading wishlist/i)).toBeVisible();
    expect(screen.queryByText(/0 wishlist items/i)).not.toBeInTheDocument();
  });

  it("keeps the wishlist count unavailable when saved games fail to load", async () => {
    vi.mocked(listSavedGames).mockRejectedValue(new Error("Offline"));

    renderScreen(<WishlistPage />);

    expect(
      await screen.findByText("Data unavailable", {
        selector: "p.mt-1.text-sm.text-muted-foreground",
      }),
    ).toBeVisible();
    expect(screen.queryByText(/0 wishlist items/i)).not.toBeInTheDocument();
  });
});
