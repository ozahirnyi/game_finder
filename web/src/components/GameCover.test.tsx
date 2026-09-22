import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { GameCover } from "./GameCover";
import { Avatar } from "./GameCover";

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
    expect(cover).not.toHaveAttribute("style");
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
    expect(container.firstElementChild).not.toHaveAttribute("style");
    expect(screen.getByText("Missing")).toBeVisible();
  });

  it("uses candidates when the primary image is absent and advances after an error", () => {
    const { container } = render(
      <GameCover
        from="#111111"
        to="#222222"
        title="Portal"
        candidates={[
          {
            src: "https://images.example.test/first.jpg",
            kind: "cover",
            srcSet: "https://images.example.test/first-2x.jpg 2x",
          },
          { src: "https://images.example.test/second.jpg", kind: "cover" },
        ]}
        sizes="264px"
      />,
    );

    const first = within(container).getByRole("img", { name: "Portal" });
    expect(first).toHaveAttribute("src", "https://images.example.test/first.jpg");
    expect(first).toHaveAttribute("sizes", "264px");
    Object.defineProperty(first, "currentSrc", {
      configurable: true,
      value: "https://images.example.test/first.jpg",
    });
    fireEvent.error(first);
    expect(within(container).getByRole("img", { name: "Portal" })).toHaveAttribute(
      "src",
      "https://images.example.test/second.jpg",
    );
  });

  it("retries the base source once when the selected srcset source fails", () => {
    const { container } = render(
      <GameCover
        from="#111"
        to="#222"
        title="High resolution"
        candidates={[
          {
            src: "https://images.example.test/cover.jpg",
            srcSet:
              "https://images.example.test/cover.jpg 264w, https://images.example.test/cover-2x.jpg 528w",
            kind: "cover",
          },
          { src: "https://images.example.test/fallback.jpg", kind: "cover" },
        ]}
      />,
    );
    const image = within(container).getByRole("img", { name: "High resolution" });
    Object.defineProperty(image, "currentSrc", {
      configurable: true,
      value: "https://images.example.test/cover-2x.jpg",
    });
    fireEvent.error(image);

    const retried = within(container).getByRole("img", { name: "High resolution" });
    expect(retried).toHaveAttribute("src", "https://images.example.test/cover.jpg");
    expect(retried).not.toHaveAttribute("srcset");
    fireEvent.error(retried);
    expect(within(container).getByRole("img", { name: "High resolution" })).toHaveAttribute(
      "src",
      "https://images.example.test/fallback.jpg",
    );
  });

  it("uses contain for poster candidates and cover for wide candidates", () => {
    const { container, rerender } = render(
      <GameCover
        from="#111"
        to="#222"
        title="Poster"
        candidates={[{ src: "https://example.test/p.jpg", kind: "cover" }]}
      />,
    );
    expect(within(container).getByRole("img", { name: "Poster" })).toHaveClass("object-contain");

    rerender(
      <GameCover
        from="#111"
        to="#222"
        title="Wide"
        candidates={[{ src: "https://example.test/w.jpg", kind: "wide" }]}
      />,
    );
    expect(within(container).getByRole("img", { name: "Wide" })).toHaveClass("object-cover");
  });

  it("does not crop a poster when it is the fallback for a hero slot", () => {
    const { container } = render(
      <GameCover
        from="#111"
        to="#222"
        title="Poster fallback"
        variant="hero"
        candidates={[{ src: "https://example.test/p.jpg", kind: "cover" }]}
      />,
    );

    expect(within(container).getByRole("img", { name: "Poster fallback" })).toHaveClass(
      "object-contain",
    );
  });

  it("recovers an avatar after its image URL changes", () => {
    const { container, rerender } = render(
      <Avatar
        from="#111"
        to="#222"
        name="Alyx Vance"
        image="https://images.example.test/broken.png"
      />,
    );
    fireEvent.error(container.querySelector("img")!);
    expect(container.querySelector("img")).not.toBeInTheDocument();

    rerender(
      <Avatar
        from="#111"
        to="#222"
        name="Alyx Vance"
        image="https://images.example.test/fixed.png"
      />,
    );
    expect(container.querySelector("img")).toHaveAttribute(
      "src",
      "https://images.example.test/fixed.png",
    );
  });
});
