// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  createFriendRequest: vi.fn(),
  getPublicUsers: vi.fn(),
}));

vi.mock("@/lib/api", () => api);
vi.mock("@/components/AppShell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import { Route } from "./users.index";

function renderUsers(initialEntry = "/users?page=2") {
  const root = createRootRoute({ component: Outlet });
  const route = createRoute({
    getParentRoute: () => root,
    path: "/users",
    validateSearch: Route.options.validateSearch,
    component: Route.options.component,
  });
  const router = createRouter({
    routeTree: root.addChildren([route]),
    history: createMemoryHistory({ initialEntries: [initialEntry] }),
  });
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  api.createFriendRequest.mockResolvedValue({ id: "request-1" });
  api.getPublicUsers.mockResolvedValue({
    items: Array.from({ length: 10 }, (_, index) => ({
      id: `user-${index + 1}`,
      public_id: `player-${index + 1}`,
      display_name: `Player ${index + 1}`,
    })),
    page: 2,
    page_size: 10,
    total: 23,
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("All users directory", () => {
  it("shows ten full-width player rows with avatars and numbered profile links", async () => {
    renderUsers();

    expect((await screen.findAllByRole("article")).length).toBe(10);
    expect(screen.getByLabelText("Player 1")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open Player 1 profile" })).toHaveAttribute(
      "href",
      "/users/player-1",
    );
    expect(screen.getByRole("link", { name: "3" })).toHaveAttribute("href", "/users?page=3");
  });

  it("submits a friend request from a player card", async () => {
    renderUsers();

    fireEvent.click((await screen.findAllByRole("button", { name: "Add friend" }))[0]);

    await waitFor(() =>
      expect(api.createFriendRequest).toHaveBeenCalledWith({ recipient_id: "user-1" }),
    );
    expect(screen.getByRole("button", { name: "Request sent" })).toBeDisabled();
  });

  it("renders relationship-aware controls without duplicate requests", async () => {
    api.getPublicUsers.mockResolvedValue({
      items: [
        { id: "friend", public_id: "ada", display_name: "Ada", relationship: "friends" },
        { id: "outgoing", public_id: "bea", display_name: "Bea", relationship: "outgoing_pending" },
        { id: "incoming", public_id: "cyd", display_name: "Cyd", relationship: "incoming_pending" },
        { id: "stranger", public_id: "dan", display_name: "Dan", relationship: "none" },
      ],
      page: 1,
      page_size: 10,
      total: 4,
    });
    renderUsers("/users?page=1");

    expect(await screen.findByRole("button", { name: "Friends" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Request sent" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Respond to request" })).toBeDisabled();
    expect(screen.getByRole("link", { name: "Open Ada profile" })).toHaveAttribute("href", "/users/ada");
    fireEvent.click(screen.getByRole("button", { name: "Add friend" }));
    await waitFor(() => expect(api.createFriendRequest).toHaveBeenCalledWith({ recipient_id: "stranger" }));
  });
});
