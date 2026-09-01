import { fireEvent, render, screen } from "@testing-library/react";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ApiError,
  getAuthSnapshot,
  getRecommendationQuota,
  getRecommendations,
  type RecommendationQuota,
} from "@/lib/api";
import { AiRecommendationSearch } from "./AiRecommendationSearch";

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    getAuthSnapshot: vi.fn(),
    subscribeToAuthChanges: vi.fn(() => () => undefined),
    getRecommendationQuota: vi.fn(),
    getRecommendations: vi.fn(),
  };
});

const availableQuota = (
  remaining = 3,
  cooldownUntil: string | null = null,
): RecommendationQuota => ({
  limit: 3,
  remaining,
  cooldown_until: cooldownUntil,
  reset_at: "2026-09-02T00:00:00Z",
});

function fillAndSubmit(prompt: string) {
  fireEvent.change(screen.getByLabelText(/describe what you want to play/i), {
    target: { value: prompt },
  });
  fireEvent.click(screen.getByRole("button", { name: /find games/i }));
}

function renderAiSearch() {
  const rootRoute = createRootRoute({ component: AiRecommendationSearch });
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  return render(<RouterProvider router={router} />);
}

describe("AiRecommendationSearch", () => {
  beforeEach(() => {
    vi.mocked(getAuthSnapshot).mockReset();
    vi.mocked(getRecommendationQuota).mockReset();
    vi.mocked(getRecommendations).mockReset();
  });

  it("does not call AI APIs for a guest and links to sign in", async () => {
    vi.mocked(getAuthSnapshot).mockReturnValue(false);

    renderAiSearch();

    expect(
      await screen.findByRole("link", { name: /sign in/i }),
    ).toHaveAttribute("href", "/login");
    expect(getRecommendationQuota).not.toHaveBeenCalled();
    expect(getRecommendations).not.toHaveBeenCalled();
  });

  it("shows remaining quota and blocks submission during cooldown", async () => {
    vi.mocked(getAuthSnapshot).mockReturnValue(true);
    vi.mocked(getRecommendationQuota).mockResolvedValue(
      availableQuota(2, new Date(Date.now() + 60_000).toISOString()),
    );

    renderAiSearch();

    expect(
      await screen.findByText(/2 of 3 AI searches remaining/i),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: /try again in/i }),
    ).toBeDisabled();
  });

  it("shows an unavailable quota state and retries loading", async () => {
    vi.mocked(getAuthSnapshot).mockReturnValue(true);
    vi.mocked(getRecommendationQuota)
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(availableQuota());

    renderAiSearch();

    expect(
      await screen.findByText("AI search allowance is unavailable"),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Find games" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(
      await screen.findByText(/3 of 3 AI searches remaining/i),
    ).toBeVisible();
    expect(getRecommendationQuota).toHaveBeenCalledTimes(2);
  });

  it("renders a matched cover, internal link, reason, and tags", async () => {
    vi.mocked(getAuthSnapshot).mockReturnValue(true);
    vi.mocked(getRecommendationQuota).mockResolvedValue(availableQuota());
    vi.mocked(getRecommendations).mockResolvedValue({
      recommendations: [
        {
          title: "Hades II",
          reason: "Fast runs",
          tags: ["Action", "Roguelike"],
          game: {
            id: 8,
            name: "Hades II",
            released: "2025-09-25",
            background_image: "cover.jpg",
            platforms: ["PC"],
          },
        },
      ],
      quota: availableQuota(2, new Date(Date.now() + 60_000).toISOString()),
    });

    renderAiSearch();
    await screen.findByText(/3 of 3 AI searches remaining/i);
    fillAndSubmit("fast runs");

    expect(
      await screen.findByRole("link", { name: /Hades II/i }),
    ).toHaveAttribute("href", "/games/8");
    expect(screen.getByRole("img", { name: "Hades II cover" })).toHaveAttribute(
      "src",
      "cover.jpg",
    );
    expect(screen.getByText("Fast runs")).toBeVisible();
    expect(screen.getByText("Action")).toBeVisible();
  });

  it("keeps existing cards after a later request fails", async () => {
    vi.mocked(getAuthSnapshot).mockReturnValue(true);
    vi.mocked(getRecommendationQuota).mockResolvedValue(availableQuota());
    vi.mocked(getRecommendations)
      .mockResolvedValueOnce({
        recommendations: [
          {
            title: "Hades II",
            reason: "Fast runs",
            tags: ["Action"],
            game: null,
          },
        ],
        quota: availableQuota(2),
      })
      .mockRejectedValueOnce(new Error("OpenAI is temporarily unavailable."));

    renderAiSearch();
    await screen.findByText(/3 of 3 AI searches remaining/i);
    fillAndSubmit("fast runs");
    expect(
      await screen.findByRole("heading", { name: "Hades II" }),
    ).toBeVisible();
    fillAndSubmit("something else");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "OpenAI is temporarily unavailable.",
    );
    expect(screen.getByRole("heading", { name: "Hades II" })).toBeVisible();
  });

  it("uses ordinary catalog search for an unmatched recommendation", async () => {
    vi.mocked(getAuthSnapshot).mockReturnValue(true);
    vi.mocked(getRecommendationQuota).mockResolvedValue(availableQuota());
    vi.mocked(getRecommendations).mockResolvedValue({
      recommendations: [
        {
          title: "Unknown Gem",
          reason: "Fits the mood",
          tags: ["Co-op"],
          game: null,
        },
      ],
      quota: availableQuota(2),
    });

    renderAiSearch();
    await screen.findByText(/3 of 3 AI searches remaining/i);
    fillAndSubmit("hidden co-op");

    const fallback = await screen.findByRole("link", {
      name: /search catalog for Unknown Gem/i,
    });
    expect(fallback).toHaveAttribute("href", "/search?q=Unknown%20Gem");
    expect(
      screen.queryByRole("link", { name: /view Unknown Gem/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Fits the mood")).toBeVisible();
    expect(screen.getByText("Co-op")).toBeVisible();
  });

  it("uses authoritative quota details from a 429 response", async () => {
    vi.mocked(getAuthSnapshot).mockReturnValue(true);
    vi.mocked(getRecommendationQuota).mockResolvedValue(availableQuota());
    vi.mocked(getRecommendations).mockRejectedValue(
      new ApiError("Daily AI search limit reached.", 429, {
        code: "ai_daily_quota_exhausted",
        message: "Daily AI search limit reached.",
        quota: availableQuota(0),
      }),
    );

    renderAiSearch();
    await screen.findByText(/3 of 3 AI searches remaining/i);
    fillAndSubmit("cozy games");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Daily AI search limit reached.",
    );
    expect(screen.getByText(/0 of 3 AI searches remaining/i)).toBeVisible();
    expect(screen.getByRole("button", { name: /resets/i })).toBeDisabled();
  });
});
