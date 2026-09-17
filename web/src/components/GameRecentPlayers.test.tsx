import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/UserProfileLink", () => ({
  UserProfileLink: ({ publicId, children }: { publicId: string; children: React.ReactNode }) => (
    <a href={`/users/${publicId}`}>{children}</a>
  ),
}));

import { GameRecentPlayers } from "./GameRecentPlayers";

describe("GameRecentPlayers", () => {
  it("ranks players by recent playtime and shows their avatars", () => {
    render(
      <GameRecentPlayers
        players={[
          {
            id: "2",
            public_id: "lena",
            display_name: "Lena",
            avatar: null,
            playtime_2weeks: 120,
          },
          {
            id: "1",
            public_id: "maksym",
            display_name: "Maksym",
            avatar: "https://avatar.test/m.png",
            playtime_2weeks: 600,
          },
        ]}
        isPending={false}
        isError={false}
        onRetry={vi.fn()}
      />,
    );

    expect(screen.getAllByTestId("recent-player-row").map((row) => row.textContent)).toEqual([
      expect.stringContaining("Maksym"),
      expect.stringContaining("Lena"),
    ]);
    expect(screen.getByAltText("Maksym")).toHaveAttribute("src", "https://avatar.test/m.png");
    expect(screen.getByRole("link", { name: "Maksym" })).toHaveAttribute("href", "/users/maksym");
  });

  it("renders loading, retryable error, and empty feedback", () => {
    const onRetry = vi.fn();
    const { rerender } = render(
      <GameRecentPlayers players={[]} isPending isError={false} onRetry={onRetry} />,
    );
    expect(screen.getByText("Loading recent players…")).toBeInTheDocument();

    rerender(<GameRecentPlayers players={[]} isPending={false} isError onRetry={onRetry} />);
    fireEvent.click(screen.getByRole("button", { name: "Retry activity" }));
    expect(onRetry).toHaveBeenCalledOnce();

    rerender(
      <GameRecentPlayers players={[]} isPending={false} isError={false} onRetry={onRetry} />,
    );
    expect(
      screen.getByText("No public players logged time in the last two weeks."),
    ).toBeInTheDocument();
  });
});
