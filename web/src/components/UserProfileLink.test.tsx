import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, params }: { children: ReactNode; params: { publicId: string } }) => (
    <a href={`/users/${params.publicId}`}>{children}</a>
  ),
}));

import { UserProfileLink } from "./UserProfileLink";

describe("UserProfileLink", () => {
  it("links a represented user to the canonical public profile", () => {
    render(<UserProfileLink publicId="owner-public">Owner</UserProfileLink>);

    expect(screen.getByRole("link", { name: "Owner" })).toHaveAttribute(
      "href",
      "/users/owner-public",
    );
  });
});
