import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "./AppShell";
import { PersonalDashboard } from "@/features/home/PersonalDashboard";
import { getSteamLibrary } from "@/lib/api";

let pathname = "/";
const getAuthSnapshot = vi.fn<() => boolean>();

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    children,
    ...props
  }: {
    to: string;
    children: React.ReactNode;
  }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useRouterState: ({
    select,
  }: {
    select: (state: { location: { pathname: string } }) => string;
  }) => select({ location: { pathname } }),
}));
vi.mock("./ThemeSelector", () => ({ ThemeSelector: () => <div /> }));
vi.mock("@/lib/api", () => ({
  getAuthSnapshot: () => getAuthSnapshot(),
  subscribeToAuthChanges: () => () => undefined,
  getSteamLibrary: vi.fn(),
}));

function mockAuth(authenticated: boolean) {
  getAuthSnapshot.mockReturnValue(authenticated);
}

const linkedSteam = {
  linked: true,
  steam_id: "1",
  persona_name: "Real Steam Name",
  avatar: null,
  country_code: null,
  linked_at: null,
};

describe("AppShell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pathname = "/";
    mockAuth(true);
    vi.mocked(getSteamLibrary).mockResolvedValue({
      steam: linkedSteam,
      games: [],
    });
  });

  it("shows the linked Steam persona in the personal dashboard", async () => {
    render(<PersonalDashboard steamAccount={linkedSteam} />);
    expect(await screen.findByText("Real Steam Name")).toBeVisible();
    expect(screen.queryByText("Marcus Chen")).not.toBeInTheDocument();
  });

  it("keeps unauthenticated navigation public", () => {
    mockAuth(false);
    render(
      <AppShell>
        <main>Guest home</main>
      </AppShell>,
    );
    expect(screen.getByRole("link", { name: "Sign in" })).toBeVisible();
    expect(
      screen.queryByRole("link", { name: "Friends" }),
    ).not.toBeInTheDocument();
  });
});
