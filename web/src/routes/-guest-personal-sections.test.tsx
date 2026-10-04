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
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  getAuthSnapshot: vi.fn(() => false),
  subscribeToAuthChanges: vi.fn(() => () => {}),
  getProfile: vi.fn(),
  getLibraryOverview: vi.fn(),
  getLibraryOverviewPage: vi.fn(),
  getFavorites: vi.fn(),
  getOnboardingSummary: vi.fn(),
  getFriends: vi.fn(),
  getIncomingFriendRequests: vi.fn(),
  getGameInvites: vi.fn(),
  getConversations: vi.fn(),
  createConversation: vi.fn(),
  getConversation: vi.fn(),
  getPublicUsers: vi.fn(),
  previewPsnLibraryRepair: vi.fn(),
  previewPsnImport: vi.fn(),
  getWishlistPage: vi.fn(),
  getPriceAlerts: vi.fn(),
}));

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  ...api,
}));
vi.mock("@/components/AppShell", () => ({
  AppShell: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));

import { Route as AccountRoute } from "./account";
import { Route as FriendsRoute } from "./friends.index";
import { Route as LibraryRoute } from "./library";
import { Route as WishlistRoute } from "./wishlist";
import { Route as MessagesRoute } from "./messages.index";
import { Route as ConversationRoute } from "./messages.$conversationId";
import { Route as UsersRoute } from "./users.index";
import { Route as PsnImportRoute } from "./psn-import";
import { Route as PsnRepairRoute } from "./psn-library-repair";

function renderSection(component: typeof AccountRoute.options.component, initialEntry = "/") {
  const root = createRootRoute({ component: Outlet });
  const section = createRoute({ getParentRoute: () => root, path: "/", component });
  const router = createRouter({
    routeTree: root.addChildren([section]),
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

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("guest personal sections", () => {
  it("does not create a conversation from a guest chat link", async () => {
    renderSection(MessagesRoute.options.component, "/?friend=friend-1");

    expect(await screen.findByRole("heading", { name: "Chats" })).toBeInTheDocument();
    expect(api.createConversation).not.toHaveBeenCalled();
  });

  it.each([
    ["account", AccountRoute.options.component, /profile/i],
    ["friends", FriendsRoute.options.component, /friends/i],
    ["library", LibraryRoute.options.component, /library/i],
    ["wishlist", WishlistRoute.options.component, /wishlist/i],
    ["chats", MessagesRoute.options.component, /chats/i],
    ["conversation", ConversationRoute.options.component, /chats/i],
    ["player directory", UsersRoute.options.component, /players/i],
    ["PlayStation import", PsnImportRoute.options.component, /PlayStation import/i],
    ["PlayStation repair", PsnRepairRoute.options.component, /PlayStation library/i],
  ])("shows a sign-in choice instead of personal data on %s", async (_name, component, section) => {
    renderSection(component);

    expect(await screen.findByRole("heading", { name: section })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/sign-in");
    expect(screen.getByRole("link", { name: "Create account" })).toHaveAttribute(
      "href",
      "/sign-up",
    );
    expect(screen.getByRole("heading", { name: "Explore without signing in" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Browse catalog/i })).toHaveAttribute(
      "href",
      "/search",
    );
    expect(screen.getByRole("link", { name: /Browse deals/i })).toHaveAttribute("href", "/deals");
    for (const request of [
      api.getProfile,
      api.getLibraryOverview,
      api.getLibraryOverviewPage,
      api.getFavorites,
      api.getOnboardingSummary,
      api.getFriends,
      api.getIncomingFriendRequests,
      api.getGameInvites,
      api.getConversations,
      api.createConversation,
      api.getConversation,
      api.getPublicUsers,
      api.previewPsnLibraryRepair,
      api.previewPsnImport,
      api.getWishlistPage,
      api.getPriceAlerts,
    ]) {
      expect(request).not.toHaveBeenCalled();
    }
  });
});
