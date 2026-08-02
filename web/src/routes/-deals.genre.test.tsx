import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ getDeals: vi.fn(), getGenreDeals: vi.fn() }));

vi.mock("@/components/AppShell", () => ({ AppShell: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("@/lib/api", () => api);
vi.mock("@tanstack/react-router", async () => {
  const actual = await vi.importActual<typeof import("@tanstack/react-router")>("@tanstack/react-router");
  return { ...actual, Link: ({ children, params, search, ...props }: any) => <a href={`/games/${params.gameId}${search?.title ? `?title=${search.title}` : ""}`} {...props}>{children}</a> };
});

import { Route } from "./deals";

const deal = (name: string, id: number) => ({
  id,
  name,
  background_image: null,
  current: { shop: "Steam", url: "https://store.example", price: { amount: 10, currency: "USD" }, regular: { amount: 20, currency: "USD" }, cut: 50 },
});

describe("DealsPage genre deals", () => {
  it("shows four popular deals and five genre sections with catalog links", async () => {
    api.getGenreDeals.mockResolvedValue({
      popular: [deal("Popular 1", 1), deal("Popular 2", 2), deal("Popular 3", 3), deal("Popular 4", 4)],
      sections: ["Action", "RPG", "Adventure", "Strategy", "Indie"].map((genre, index) => ({ genre, results: [deal(`${genre} game`, index + 10)] })),
    });
    const DealsPage = Route.options.component!;
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><DealsPage /></QueryClientProvider>);

    expect(await screen.findByText("Popular on Steam")).toBeInTheDocument();
    for (const title of ["Popular 1", "Popular 2", "Popular 3", "Popular 4", "Action", "RPG", "Adventure", "Strategy", "Indie"]) expect(screen.getByText(title)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /open action game on playfinder/i })).toHaveAttribute("href", "/games/10?title=Action game");
  });
});
