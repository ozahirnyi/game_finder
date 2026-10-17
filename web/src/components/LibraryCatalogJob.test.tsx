import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  getToken: vi.fn(() => "test-token"),
  getCurrentLibraryCatalogMatchingJob: vi.fn(),
  startLibraryCatalogMatchingJob: vi.fn(),
  cancelLibraryCatalogMatchingJob: vi.fn(),
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
  expect(screen.getByRole("button", { name: "Cancel" })).toBeEnabled();
  expect(document.querySelectorAll(".animate-spin")).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: "Close catalog matching" }));
  expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  expect(document.querySelectorAll(".animate-spin")).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: "Match PlayStation games" }));
  expect(screen.getByRole("progressbar")).toBeVisible();
  expect(document.querySelectorAll(".animate-spin")).toHaveLength(1);
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
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Find catalog matches" })).toBeEnabled(),
  );
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
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Find catalog matches" })).toBeEnabled(),
  );
  fireEvent.click(screen.getByRole("button", { name: "Find catalog matches" }));
  await waitFor(() => expect(api.startLibraryCatalogMatchingJob).toHaveBeenCalledOnce());
  api.getToken.mockReturnValue("owner-b");
  await act(async () => {
    client.clear();
    finish(running);
  });
  expect(client.getQueryData(["library-catalog-matching-job", "psn"])).toBeUndefined();
});

const savedItem = {
  game_id: "one",
  title: "Saved result",
  source: "psn",
  catalog_game_id: null,
  status: "matched",
  suggestions: [{ id: 1, title: "Hades", confidence: "exact", platforms: [] }],
};
function showJob(job: unknown, hasMatchedGames = false) {
  api.getCurrentLibraryCatalogMatchingJob.mockResolvedValue(job);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <LibraryCatalogMatchLauncher source="psn" hasMatchedGames={hasMatchedGames} />
    </QueryClientProvider>,
  );
  return client;
}

it("keeps saved results and selections until a repeated search is explicitly confirmed", async () => {
  showJob({ ...running, status: "succeeded", result: { ...running.result, items: [savedItem] } });
  await screen.findByRole("heading", { name: "Saved result" });
  fireEvent.click(screen.getByLabelText("Select Saved result"));
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Find catalog matches" })).toBeEnabled(),
  );
  fireEvent.click(screen.getByRole("button", { name: "Find catalog matches" }));
  expect(screen.getByRole("alertdialog")).toHaveTextContent("Find catalog matches again?");
  expect(api.startLibraryCatalogMatchingJob).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Keep current results" }));
  expect(screen.getByLabelText("Select Saved result")).toBeChecked();
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Find catalog matches" })).toBeEnabled(),
  );
  fireEvent.click(screen.getByRole("button", { name: "Find catalog matches" }));
  api.startLibraryCatalogMatchingJob.mockResolvedValue({ ...running, id: "new-job" });
  fireEvent.click(screen.getByRole("button", { name: "Search again" }));
  await waitFor(() => expect(api.startLibraryCatalogMatchingJob).toHaveBeenCalledOnce());
});

it("also confirms a new search when links were already applied and no preview remains", async () => {
  showJob(null, true);
  fireEvent.click(screen.getByRole("button", { name: "Match PlayStation games" }));
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Find catalog matches" })).toBeEnabled(),
  );
  fireEvent.click(screen.getByRole("button", { name: "Find catalog matches" }));
  expect(screen.getByRole("alertdialog")).toHaveTextContent("Find catalog matches again?");
  expect(api.startLibraryCatalogMatchingJob).not.toHaveBeenCalled();
});

it("cancels on the server and restores partial results without starting or applying anything", async () => {
  const stopped = {
    ...running,
    status: "cancelled",
    result: { ...running.result, items: [savedItem] },
  };
  const client = showJob(running);
  api.cancelLibraryCatalogMatchingJob.mockResolvedValue(stopped);
  await screen.findByRole("progressbar");
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  await waitFor(() =>
    expect(api.cancelLibraryCatalogMatchingJob).toHaveBeenCalledWith("saved-job"),
  );
  await screen.findByText(/Search cancelled/);
  expect(screen.getByRole("heading", { name: "Saved result" })).toBeVisible();
  expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  expect(document.querySelectorAll(".animate-spin")).toHaveLength(0);
  expect(client.getQueryData(["library-catalog-matching-job", "psn"])).toEqual(stopped);
  expect(api.startLibraryCatalogMatchingJob).not.toHaveBeenCalled();
  expect(api.applyLibraryCatalogMatches).not.toHaveBeenCalled();
});

it("reports cancellation failure and keeps a retryable Cancel button", async () => {
  showJob(running);
  api.cancelLibraryCatalogMatchingJob.mockRejectedValue(new Error("Could not cancel search"));
  await screen.findByRole("progressbar");
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Could not cancel search");
  expect(screen.getByRole("button", { name: "Cancel" })).toBeEnabled();
});

it("does not restore a late cancellation response into a different account", async () => {
  api.getToken.mockReturnValue("first-owner");
  let finish!: (job: unknown) => void;
  const client = showJob(running);
  api.cancelLibraryCatalogMatchingJob.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  await screen.findByRole("progressbar");
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  await waitFor(() => expect(api.cancelLibraryCatalogMatchingJob).toHaveBeenCalledOnce());
  api.getToken.mockReturnValue("second-owner");
  await act(async () => {
    client.clear();
    finish({ ...running, status: "cancelled" });
  });
  expect(client.getQueryData(["library-catalog-matching-job", "psn"])).toBeUndefined();
});

it("waits for saved results before allowing a new search", async () => {
  let finish!: (job: unknown) => void;
  api.getCurrentLibraryCatalogMatchingJob.mockImplementation(
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
  expect(screen.getByRole("button", { name: "Find catalog matches" })).toBeDisabled();
  await act(async () => {
    finish({ ...running, status: "succeeded", result: { ...running.result, items: [savedItem] } });
  });
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Find catalog matches" })).toBeEnabled(),
  );
  fireEvent.click(screen.getByRole("button", { name: "Find catalog matches" }));
  expect(await screen.findByRole("alertdialog")).toBeVisible();
  expect(api.startLibraryCatalogMatchingJob).not.toHaveBeenCalled();
});
