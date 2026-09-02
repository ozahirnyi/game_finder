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

  it("uses a cropped hero treatment and returns to the gradient after its provider image fails", () => {
    const { container } = render(
      <GameCover
        from="#111111"
        to="#222222"
        title="Live game"
        image="https://images.example.test/hero.jpg"
        variant="hero"
        bare
      />,
    );

    const cover = container.firstElementChild;
    expect(cover).toHaveAttribute("data-visual-role", "hero");
    const image = within(container).getByRole("img", { name: "Live game" });
    expect(image).toHaveClass("object-[center_35%]");

    fireEvent.error(image);

    expect(within(container).queryByRole("img", { name: "Live game" })).not.toBeInTheDocument();
    expect(cover?.getAttribute("style")).toContain("linear-gradient");
  });
});
