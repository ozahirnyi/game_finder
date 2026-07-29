import { render, screen } from "@testing-library/react";
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
});
