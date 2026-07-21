import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import FriendsPage from "./friends/page";
import PsnPage from "./psn/page";
import SearchPage from "./search/page";
import WishlistPage from "./wishlist/page";

vi.mock("@tanstack/react-router", () => ({
  useRouterState: ({
    select,
  }: {
    select: (state: { location: { searchStr: string } }) => unknown;
  }) => select({ location: { searchStr: "" } }),
}));

describe("navigation destinations", () => {
  it.each([
    ["Search", SearchPage],
    ["Wishlist", WishlistPage],
    ["Sign in to see friends", FriendsPage],
    ["Sign in to import PlayStation games", PsnPage],
  ])("renders a non-404 page for %s", (title, Page) => {
    render(<Page />);

    expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
  });
});
