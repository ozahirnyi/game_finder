import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { GameCover } from "./GameCover";

describe("GameCover", () => {
  it("renders a real catalog cover when src is present", () => {
    render(<GameCover title="Hades II" src="https://cdn.example/hades.jpg" />);

    expect(screen.getAllByRole("img")).toHaveLength(1);
    expect(screen.getByRole("img", { name: "Hades II cover" })).toHaveAttribute(
      "src",
      "https://cdn.example/hades.jpg",
    );
    expect(screen.getByText("Hades II").closest('[aria-hidden="true"]')).not.toBeNull();
  });

  it("keeps the styled fallback when src is absent", () => {
    render(<GameCover title="Unknown Game" src={null} />);

    expect(
      screen.getByRole("img", { name: "Unknown Game cover unavailable" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("img", { name: "Unknown Game cover" }),
    ).not.toBeInTheDocument();
  });
});
