import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./ConnectedServices", () => ({ ConnectedServices: () => <div /> }));
vi.mock("./NotificationsPanel", () => ({ NotificationsPanel: () => <div /> }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

import { ProfileView, type ProfileData } from "./ProfileView";

afterEach(cleanup);

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
const renderProfile = (isSelf: boolean) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ProfileView profile={profile} isSelf={isSelf} />
    </QueryClientProvider>,
  );

describe("ProfileView library visibility", () => {
  it("hides the library from the profile owner", () => {
    renderProfile(true);
    expect(screen.queryByText("Your library")).not.toBeInTheDocument();
  });
  it("keeps the library on a friend profile", () => {
    renderProfile(false);
    expect(screen.getByText("Their library")).toBeInTheDocument();
  });
  it("opens editable profile settings for the profile owner", () => {
    renderProfile(true);
    fireEvent.click(screen.getByRole("button", { name: /^settings$/i }));
    expect(screen.getByRole("dialog", { name: /profile settings/i })).toBeInTheDocument();
  });
  it("formats friend game playtime from minutes", () => {
    profile.games[0].playtime = 125;
    renderProfile(false);
    expect(screen.getByText("2h 5m")).toBeInTheDocument();
  });
});
