import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ getDeals: vi.fn(), getGenreDeals: vi.fn() }));

vi.mock("@/components/AppShell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/lib/api", () => api);
vi.mock("@tanstack/react-router", async () => {
  const actual =
    await vi.importActual<typeof import("@tanstack/react-router")>("@tanstack/react-router");
  return {
    ...actual,
    Link: ({
      children,
      params,
      search,
      ...props
    }: React.ComponentPropsWithoutRef<"a"> & {
      params: { gameId: string };
      search?: { source?: string; title?: string };
    }) => (
      <a
        href={`/games/${params.gameId}${search?.source ? `?source=${search.source}&title=${search.title}` : search?.title ? `?title=${search.title}` : ""}`}
        {...props}
      >
        {children}
      </a>
    ),
  };
});

import { Route } from "./deals";

afterEach(cleanup);

const deal = (name: string, id: number) => ({
  id,
  name,
  background_image: null,
  current: {
    shop: "Steam",
    url: "https://store.example",
    price: { amount: 10, currency: "USD" },
    regular: { amount: 20, currency: "USD" },
    cut: 50,
  },
});

describe("DealsPage genre deals", () => {
  it("shows four popular deals and five genre sections with catalog links", async () => {
    api.getGenreDeals.mockResolvedValue({
      popular: [
        deal("Popular 1", 1),
        deal("Popular 2", 2),
        deal("Popular 3", 3),
        deal("Popular 4", 4),
      ],
      sections: ["Action", "RPG", "Adventure", "Strategy", "Indie"].map((genre, index) => ({
        genre,
        results: [deal(`${genre} game`, index + 10)],
      })),
    });
    const DealsPage = Route.options.component!;
    render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <DealsPage />
      </QueryClientProvider>,
    );

    expect(await screen.findByText("Popular on Steam")).toBeInTheDocument();
    for (const title of ["Popular 1", "Popular 2", "Popular 3", "Popular 4"])
      expect(screen.getAllByText(title).length).toBeGreaterThan(0);
    for (const genre of ["Action", "RPG", "Adventure", "Strategy", "Indie"])
      expect(screen.getByRole("button", { name: genre })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /open action game on playfinder/i })).toHaveAttribute(
      "href",
      "/games/10?title=Action game",
    );
  });

  it("shows only the selected genre's five large cards", async () => {
    api.getGenreDeals.mockResolvedValue({
      popular: [
        deal("Popular 1", 1),
        deal("Popular 2", 2),
        deal("Popular 3", 3),
        deal("Popular 4", 4),
      ],
      sections: ["Action", "RPG", "Adventure", "Strategy", "Indie"].map((genre, index) => ({
        genre,
        results: [deal(`${genre} game`, index + 10)],
      })),
    });
    const DealsPage = Route.options.component!;
    render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <DealsPage />
      </QueryClientProvider>,
    );

    await screen.findAllByText("Action game");
    fireEvent.click(screen.getByRole("button", { name: "RPG" }));

    expect(screen.getAllByText("RPG game")).not.toHaveLength(0);
    expect(screen.queryByText("Action game")).not.toBeInTheDocument();
  });

  it("keeps a Steam-only genre card navigable in a full-width selected-genre layout", async () => {
    api.getGenreDeals.mockResolvedValue({
      popular: [
        deal("Popular 1", 1),
        deal("Popular 2", 2),
        deal("Popular 3", 3),
        deal("Popular 4", 4),
      ],
      sections: [
        {
          genre: "Action",
          results: [
            { ...deal("Steam fallback", null as unknown as number), id: null, steam_appid: 620 },
          ],
        },
        ...["RPG", "Adventure", "Strategy", "Indie"].map((genre) => ({ genre, results: [] })),
      ],
    });
    const DealsPage = Route.options.component!;
    render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <DealsPage />
      </QueryClientProvider>,
    );

    expect(
      await screen.findByRole("link", { name: /open steam fallback on playfinder/i }),
    ).toHaveAttribute("href", "/games/620?source=steam&title=Steam fallback");
    expect(screen.getByTestId("selected-genre-deals")).not.toHaveClass("xl:grid-cols-5");
  });
});
