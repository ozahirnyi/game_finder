import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./ConnectedServices", () => ({ ConnectedServices: () => <div /> }));
vi.mock("./NotificationsPanel", () => ({ NotificationsPanel: () => <div /> }));
vi.mock("@tanstack/react-router", () => ({ Link: ({ children }: { children: ReactNode }) => <>{children}</> }));

import { ProfileView, type ProfileData } from "./ProfileView";

const profile: ProfileData = {
  name: "Player",
  handle: "player",
  avatarFrom: "#111",
  avatarTo: "#222",
  region: "US",
  hours: "10h",
  stores: [],
  games: [{ id: "1", title: "Portal", coverFrom: "#111", coverTo: "#222" }],
};

describe("ProfileView library visibility", () => {
  it("hides the library from the profile owner", () => {
    render(<ProfileView profile={profile} isSelf />);

    expect(screen.queryByText("Your library")).not.toBeInTheDocument();
  });

  it("keeps the library on a friend profile", () => {
    render(<ProfileView profile={profile} isSelf={false} />);

    expect(screen.getByText("Their library")).toBeInTheDocument();
  });
});
