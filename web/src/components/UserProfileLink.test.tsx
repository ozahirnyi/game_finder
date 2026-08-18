import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    params,
    "aria-label": ariaLabel,
  }: {
    children: ReactNode;
    params: { publicId: string };
    "aria-label"?: string;
  }) => (
    <a href={`/users/${params.publicId}`} aria-label={ariaLabel}>
      {children}
    </a>
  ),
}));

import { UserProfileLink } from "./UserProfileLink";

describe("UserProfileLink", () => {
  it("links a represented user to the canonical public profile", () => {
    render(
      <UserProfileLink publicId="owner-public" aria-label="Open Owner's profile">
        Owner
      </UserProfileLink>,
    );

    expect(screen.getByRole("link", { name: "Open Owner's profile" })).toHaveAttribute(
      "href",
      "/users/owner-public",
    );
  });
});
