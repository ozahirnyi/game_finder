import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  getToken: vi.fn(() => "test-token"),
  getCurrentLibraryCatalogMatchingJob: vi.fn(),
  startLibraryCatalogMatchingJob: vi.fn(),
  dismissLibraryCatalogMatchingJob: vi.fn(),
  applyLibraryCatalogMatches: vi.fn(),
  searchGames: vi.fn(),
}));
vi.mock("@/lib/api", () => api);
import { LibraryCatalogMatchLauncher } from "./LibraryCatalogMatches";

const running = {
  id: "saved-job",
  status: "running",
  result: {
    total: 5,
    processed: 2,
    matched: 1,
    remaining: 3,
    include_linked: false,
    items: [],
  },
};

beforeEach(() => vi.resetAllMocks());
afterEach(cleanup);

it("restores a running task with progress and saved results after leaving Library", async () => {
  api.getCurrentLibraryCatalogMatchingJob.mockResolvedValue(running);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function show() {
    return render(
      <QueryClientProvider client={client}>
        <LibraryCatalogMatchLauncher source="psn" />
      </QueryClientProvider>,
    );
  }
  const first = show();
  expect(await screen.findByRole("progressbar")).toHaveAttribute("value", "2");
  expect(screen.getByRole("progressbar")).toHaveAttribute("max", "5");
  expect(screen.getByRole("status")).toHaveTextContent("2 of 5");
  expect(screen.getByRole("status")).toHaveTextContent("1 game");
  expect(screen.getByRole("status")).toHaveTextContent("3 remaining");
  expect(screen.getByRole("button", { name: "Finding catalog matches…" })).toBeDisabled();
  first.unmount();
  const completed = {
    ...running,
    status: "succeeded",
    result: {
      ...running.result,
      processed: 5,
      remaining: 0,
      items: [
        {
          game_id: "one",
          title: "Saved result",
          source: "psn",
          catalog_game_id: null,
          status: "matched",
          suggestions: [{ id: 1, title: "Hades", confidence: "exact", platforms: [] }],
        },
      ],
    },
  };
  api.getCurrentLibraryCatalogMatchingJob.mockResolvedValue(completed);
  await act(async () => {
    client.setQueryData(["library-catalog-matching-job", "psn"], completed);
  });
  show();
  expect(await screen.findByRole("heading", { name: "Saved result" })).toBeVisible();
  expect(api.startLibraryCatalogMatchingJob).not.toHaveBeenCalled();
  expect(api.applyLibraryCatalogMatches).not.toHaveBeenCalled();
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Apply selected (0)" })).toBeDisabled(),
  );
});

it("restores a failed task and starts a retry only when requested", async () => {
  api.getCurrentLibraryCatalogMatchingJob.mockResolvedValue({
    ...running,
    status: "failed",
    error: "Matching failed; please retry.",
  });
  api.startLibraryCatalogMatchingJob.mockResolvedValue({
    ...running,
    id: "retry-job",
    status: "queued",
    result: {
      ...running.result,
      processed: 0,
      matched: 0,
      remaining: 5,
    },
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <LibraryCatalogMatchLauncher source="psn" />
    </QueryClientProvider>,
  );
  expect(await screen.findByRole("alert")).toHaveTextContent("Matching failed; please retry.");
  expect(api.startLibraryCatalogMatchingJob).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Find catalog matches" }));
  await waitFor(() =>
    expect(api.startLibraryCatalogMatchingJob).toHaveBeenCalledWith(false, "psn"),
  );
  expect(await screen.findByRole("progressbar")).toHaveAttribute("value", "0");
  expect(api.applyLibraryCatalogMatches).not.toHaveBeenCalled();
});

it("does not restore a late start response into another sign-in session", async () => {
  api.getToken.mockReturnValue("owner-a");
  api.getCurrentLibraryCatalogMatchingJob.mockResolvedValue(null);
  let finish!: (job: unknown) => void;
  api.startLibraryCatalogMatchingJob.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <LibraryCatalogMatchLauncher source="psn" />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Match PlayStation games" }));
  fireEvent.click(screen.getByRole("button", { name: "Find catalog matches" }));
  await waitFor(() => expect(api.startLibraryCatalogMatchingJob).toHaveBeenCalledOnce());
  api.getToken.mockReturnValue("owner-b");
  await act(async () => {
    client.clear();
    finish(running);
  });
  expect(client.getQueryData(["library-catalog-matching-job", "psn"])).toBeUndefined();
});
