import { QueryClient } from "@tanstack/react-query";
import {
  RouterProvider,
  createMemoryHistory,
  createRouter,
} from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { routeTree } from "@/routeTree.gen";

const api = vi.hoisted(() => ({
  exchangeGoogleCode: vi.fn(),
  exchangeSteamCode: vi.fn(),
}));

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  exchangeGoogleCode: api.exchangeGoogleCode,
  exchangeSteamCode: api.exchangeSteamCode,
}));

describe("OAuth callback route", () => {
  it("does not exchange a denied Google callback and renders a retry link", async () => {
    vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
    const history = createMemoryHistory({
      initialEntries: ["/auth/callback?provider=google&error=access_denied"],
    });
    const router = createRouter({
      routeTree,
      context: { queryClient: new QueryClient() },
      history,
    });

    await router.load();
    render(<RouterProvider router={router} />);

    expect(
      await screen.findByRole("link", { name: "Back to sign in" }),
    ).toHaveAttribute("href", "/login");
    expect(api.exchangeGoogleCode).not.toHaveBeenCalled();
    expect(api.exchangeSteamCode).not.toHaveBeenCalled();
  });
});
