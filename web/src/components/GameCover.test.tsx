import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Avatar, GameCover } from "./GameCover";

describe("GameCover", () => {
  it("renders a real remote cover image instead of treating its URL as a color", () => {
    render(
      <GameCover
        from="https://images.example.test/hades.jpg"
        to="#111827"
        title="Hades"
      />,
    );

    expect(screen.getByRole("img", { name: "Hades" })).toHaveAttribute(
      "src",
      "https://images.example.test/hades.jpg",
    );
    expect(screen.queryByText(/GF ·/)).not.toBeInTheDocument();
    expect(
      screen.queryByText("Hades", { selector: "span" }),
    ).not.toBeInTheDocument();
  });
});

describe("Avatar", () => {
  it("renders a remote account avatar when one is available", () => {
    render(
      <Avatar
        from="#111"
        to="#222"
        name="Niko"
        imageUrl="https://avatars.example.test/niko.jpg"
      />,
    );

    expect(screen.getByRole("img", { name: "Niko" })).toHaveAttribute(
      "src",
      "https://avatars.example.test/niko.jpg",
    );
  });
});
