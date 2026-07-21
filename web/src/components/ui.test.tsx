import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GameCover } from "./GameCover";
import { Badge, Button, Panel, Section, StatePanel } from "./ui";

describe("design primitives", () => {
  it("renders a supplied cover URL as an accessible image", () => {
    render(
      <GameCover
        title="Hades II"
        src="https://images.example.test/hades-ii.jpg"
      />,
    );

    expect(screen.getByRole("img", { name: "Hades II" })).toHaveAttribute(
      "src",
      "https://images.example.test/hades-ii.jpg",
    );
  });

  it("renders the title without an image element", () => {
    const { container } = render(
      <GameCover title="Hades II" from="#845EC2" to="#2C73D2" />,
    );

    expect(screen.getByText("Hades II")).toBeVisible();
    expect(
      container.querySelector("div.relative.overflow-hidden img"),
    ).not.toBeInTheDocument();
  });

  it("renders error state with an enabled retry action", () => {
    const retry = vi.fn();

    render(
      <StatePanel
        kind="error"
        title="Could not load"
        action={{ label: "Retry", onClick: retry }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(retry).toHaveBeenCalledOnce();
  });

  it("keeps Button native semantics while forwarding button attributes", () => {
    render(
      <Button type="submit" disabled>
        Save
      </Button>,
    );

    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("groups panel, badge, and section content with their supplied labels", () => {
    render(
      <Section title="Trending games" detail="What players are watching">
        <Panel aria-label="Trending game list">
          <Badge>Popular</Badge>
        </Panel>
      </Section>,
    );

    expect(
      screen.getByRole("region", { name: "Trending games" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Trending game list" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Popular")).toBeInTheDocument();
  });
});
