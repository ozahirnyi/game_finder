import { act, fireEvent, render, screen } from "@testing-library/react";
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
  type AIRecommendationResponse,
  type RecommendationQuota,
} from "@/lib/api";
import { AiRecommendationSearch } from "./AiRecommendationSearch";

const authStore = vi.hoisted(() => ({
  authenticated: false,
  listeners: new Set<() => void>(),
}));

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    getAuthSnapshot: vi.fn(() => authStore.authenticated),
    subscribeToAuthChanges: vi.fn((listener: () => void) => {
      authStore.listeners.add(listener);
      return () => authStore.listeners.delete(listener);
    }),
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

function setAuthenticated(authenticated: boolean) {
  act(() => {
    authStore.authenticated = authenticated;
    authStore.listeners.forEach((listener) => listener());
  });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
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
    authStore.authenticated = false;
    authStore.listeners.clear();
    vi.mocked(getAuthSnapshot).mockClear();
    vi.mocked(getRecommendationQuota).mockReset();
    vi.mocked(getRecommendations).mockReset();
  });

  it("does not call AI APIs for a guest and links to sign in", async () => {
    authStore.authenticated = false;

    renderAiSearch();

    expect(
      await screen.findByRole("link", { name: /sign in/i }),
    ).toHaveAttribute("href", "/login");
    expect(getRecommendationQuota).not.toHaveBeenCalled();
    expect(getRecommendations).not.toHaveBeenCalled();
  });

  it("shows remaining quota and blocks submission during cooldown", async () => {
    authStore.authenticated = true;
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
    authStore.authenticated = true;
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
    authStore.authenticated = true;
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
    authStore.authenticated = true;
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
    authStore.authenticated = true;
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
    authStore.authenticated = true;
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

  it("clears account-scoped cards and quota across logout and login", async () => {
    authStore.authenticated = true;
    const nextQuota = deferred<RecommendationQuota>();
    vi.mocked(getRecommendationQuota)
      .mockResolvedValueOnce(availableQuota())
      .mockImplementationOnce(() => nextQuota.promise);
    vi.mocked(getRecommendations).mockResolvedValue({
      recommendations: [
        {
          title: "Hades II",
          reason: "Fast runs",
          tags: ["Action"],
          game: null,
        },
      ],
      quota: availableQuota(2),
    });

    renderAiSearch();
    await screen.findByText(/3 of 3 AI searches remaining/i);
    fillAndSubmit("fast runs");
    expect(
      await screen.findByRole("heading", { name: "Hades II" }),
    ).toBeVisible();

    setAuthenticated(false);
    expect(await screen.findByRole("link", { name: /sign in/i })).toBeVisible();
    setAuthenticated(true);

    expect(
      await screen.findByText("Loading AI search allowance"),
    ).toBeVisible();
    expect(
      screen.queryByText(/AI searches remaining/i),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Hades II" }),
    ).not.toBeInTheDocument();
  });

  it("ignores a quota response from an earlier auth session", async () => {
    authStore.authenticated = true;
    const oldQuota = deferred<RecommendationQuota>();
    const currentQuota = deferred<RecommendationQuota>();
    vi.mocked(getRecommendationQuota)
      .mockImplementationOnce(() => oldQuota.promise)
      .mockImplementationOnce(() => currentQuota.promise);

    renderAiSearch();
    expect(
      await screen.findByText("Loading AI search allowance"),
    ).toBeVisible();
    setAuthenticated(false);
    setAuthenticated(true);
    currentQuota.resolve(availableQuota(2));
    expect(
      await screen.findByText(/2 of 3 AI searches remaining/i),
    ).toBeVisible();

    oldQuota.resolve(availableQuota(0));
    await act(async () => {
      await oldQuota.promise;
    });

    expect(screen.getByText(/2 of 3 AI searches remaining/i)).toBeVisible();
    expect(
      screen.queryByText(/0 of 3 AI searches remaining/i),
    ).not.toBeInTheDocument();
  });

  it("ignores a recommendation response from an earlier auth session", async () => {
    authStore.authenticated = true;
    const oldRecommendations = deferred<AIRecommendationResponse>();
    vi.mocked(getRecommendationQuota)
      .mockResolvedValueOnce(availableQuota())
      .mockResolvedValueOnce(availableQuota(2));
    vi.mocked(getRecommendations).mockImplementationOnce(
      () => oldRecommendations.promise,
    );

    renderAiSearch();
    await screen.findByText(/3 of 3 AI searches remaining/i);
    fillAndSubmit("old request");
    expect(
      screen.getByRole("button", { name: /finding games/i }),
    ).toBeDisabled();
    setAuthenticated(false);
    setAuthenticated(true);
    expect(
      await screen.findByText(/2 of 3 AI searches remaining/i),
    ).toBeVisible();

    oldRecommendations.resolve({
      recommendations: [
        {
          title: "Stale Game",
          reason: "From the old session",
          tags: ["Stale"],
          game: null,
        },
      ],
      quota: availableQuota(0),
    });
    await act(async () => {
      await oldRecommendations.promise;
    });

    expect(screen.queryByText("Stale Game")).not.toBeInTheDocument();
    expect(screen.getByText(/2 of 3 AI searches remaining/i)).toBeVisible();
  });

  it("blocks another request during a cooldown returned with recommendations", async () => {
    authStore.authenticated = true;
    vi.mocked(getRecommendationQuota).mockResolvedValue(availableQuota());
    vi.mocked(getRecommendations).mockResolvedValue({
      recommendations: [
        {
          title: "Hades II",
          reason: "Fast runs",
          tags: ["Action"],
          game: null,
        },
      ],
      quota: availableQuota(2, new Date(Date.now() + 60_000).toISOString()),
    });

    renderAiSearch();
    await screen.findByText(/3 of 3 AI searches remaining/i);
    fillAndSubmit("fast runs");

    const cooldownButton = await screen.findByRole("button", {
      name: /try again in/i,
    });
    expect(cooldownButton).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/describe what you want to play/i), {
      target: { value: "second request" },
    });
    fireEvent.submit(cooldownButton.closest("form")!);
    expect(getRecommendations).toHaveBeenCalledTimes(1);
  });
});
