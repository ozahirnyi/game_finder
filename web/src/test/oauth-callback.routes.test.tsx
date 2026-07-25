import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  exchangeGoogleCode: vi.fn(),
  exchangeSteamCode: vi.fn(),
  setToken: vi.fn(),
}));
const routeState = vi.hoisted(() => ({
  search: {} as Record<string, string>,
}));
const navigate = vi.fn();

vi.mock("@/lib/api", () => api);
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: object) => ({
    ...options,
    useSearch: () => routeState.search,
  }),
  Link: ({ children, to }: React.ComponentProps<"a"> & { to: string }) => (
    <a href={to}>{children}</a>
  ),
  useNavigate: () => navigate,
}));

import { Route as CallbackRoute } from "@/routes/auth.callback";

function renderCallback() {
  const Component = (CallbackRoute as { component: React.ComponentType }).component;
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <Component />
    </QueryClientProvider>,
  );
}

describe("OAuth callback route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exchanges Google code, stores the token, and opens profile", async () => {
    routeState.search = { provider: "google", exchange_code: "one-time-code" };
    api.exchangeGoogleCode.mockResolvedValue({ access_token: "token", token_type: "bearer" });

    renderCallback();

    await waitFor(() => expect(api.exchangeGoogleCode).toHaveBeenCalledWith("one-time-code"));
    expect(api.setToken).toHaveBeenCalledWith("token");
    expect(navigate).toHaveBeenCalledWith({ to: "/profile" });
  });

  it("does not store a token for an invalid Steam callback", async () => {
    routeState.search = { provider: "steam", exchange_code: "expired-code" };
    api.exchangeSteamCode.mockRejectedValue(new Error("expired"));

    renderCallback();

    expect(await screen.findByText("Sign-in expired. Please try again.")).toBeVisible();
    expect(api.setToken).not.toHaveBeenCalled();
  });
});
