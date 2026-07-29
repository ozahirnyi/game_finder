import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { GameCover } from "./GameCover";

describe("GameCover", () => {
  it("renders the supplied real cover image", () => {
    render(
      <GameCover
        from="#111111"
        to="#222222"
        title="Live game"
        image="https://images.example.test/live-game.jpg"
      />,
    );

    expect(screen.getByRole("img", { name: "Live game" })).toHaveAttribute(
      "src",
      "https://images.example.test/live-game.jpg",
    );
  });

  it("uses the fallback cover when the primary image fails", () => {
    const { container } = render(
      <GameCover
        from="#111111"
        to="#222222"
        title="Live game"
        image="https://images.example.test/primary.jpg"
        fallbackImage="https://images.example.test/fallback.jpg"
      />,
    );

    const image = within(container).getByRole("img", { name: "Live game" });
    fireEvent.error(image);

    expect(within(container).getByRole("img", { name: "Live game" })).toHaveAttribute(
      "src",
      "https://images.example.test/fallback.jpg",
    );
  });
});
