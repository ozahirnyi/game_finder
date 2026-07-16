import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import FriendsPage from "./friends/page";
import PsnPage from "./psn/page";
import SearchPage from "./search/page";
import WishlistPage from "./wishlist/page";

describe("navigation destination placeholders", () => {
  it.each([
    ["Search", SearchPage],
    ["Wishlist", WishlistPage],
    ["Friends", FriendsPage],
    ["PSN", PsnPage],
  ])("renders a non-404 page for %s", (title, Page) => {
    render(<Page />);

    expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
  });
});
