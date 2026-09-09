import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ removeFriend: vi.fn(), blockUser: vi.fn() }));
vi.mock("@/lib/api", async () => ({ ...(await vi.importActual("@/lib/api")), ...api }));
import { FriendActions } from "./FriendActions";
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
it("requires confirmation, reports failures and permits retry", async () => {
  api.removeFriend.mockRejectedValueOnce(new Error("Offline")).mockResolvedValueOnce(undefined);
  render(
    <QueryClientProvider client={new QueryClient()}>
      <FriendActions userId="alex" name="Alex" isFriend />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Remove friend" }));
  expect(api.removeFriend).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Confirm removal" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Offline");
  fireEvent.click(screen.getByRole("button", { name: "Confirm removal" }));
  expect(await screen.findByRole("status")).toHaveTextContent("Friend removed");
});
