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

  it("uses a cropped hero treatment and returns to a neutral surface after its provider image fails", () => {
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
    expect(cover).toHaveClass("bg-surface-2");
    expect(cover?.getAttribute("style")).not.toContain("gradient");
  });

  it("shows portrait art without cropping when a hero has no landscape image", () => {
    render(
      <GameCover
        from="#111111"
        to="#222222"
        title="Portrait Only"
        variant="hero"
        portraitImage="https://images.example.test/cover.jpg"
        bare
      />,
    );

    expect(screen.getByRole("img", { name: "Portrait Only" })).toHaveClass("object-contain");
  });

  it("uses its alternate image before the title fallback", () => {
    render(
      <GameCover
        from="#111111"
        to="#222222"
        title="Retry"
        variant="hero"
        image="https://images.example.test/primary.jpg"
        fallbackImage="https://images.example.test/alternate.jpg"
      />,
    );

    fireEvent.error(screen.getByRole("img", { name: "Retry" }));

    expect(screen.getByRole("img", { name: "Retry" })).toHaveAttribute(
      "src",
      "https://images.example.test/alternate.jpg",
    );
  });

  it("uses a neutral surface after every image source fails", () => {
    const { container } = render(
      <GameCover
        from="#111111"
        to="#222222"
        title="Missing"
        image="https://images.example.test/primary.jpg"
        fallbackImage="https://images.example.test/fallback.jpg"
      />,
    );

    fireEvent.error(screen.getByRole("img", { name: "Missing" }));
    fireEvent.error(screen.getByRole("img", { name: "Missing" }));

    expect(container.firstElementChild).toHaveClass("bg-surface-2");
    expect(container.firstElementChild?.getAttribute("style")).not.toContain("gradient");
    expect(screen.getByText("Missing")).toBeVisible();
  });
});
