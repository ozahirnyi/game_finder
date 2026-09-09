import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({
  getConversations: vi.fn(),
  getConversation: vi.fn(),
  getConversationMessages: vi.fn(),
  createMessage: vi.fn(),
  markConversationRead: vi.fn(),
  getProfile: vi.fn(),
}));
vi.mock("@/lib/api", async () => ({ ...(await vi.importActual("@/lib/api")), ...api }));
import { MessagesScreen } from "./MessagesScreen";
const conversation = {
  id: "chat",
  participant: { id: "friend", display_name: "Alex" },
  can_message: true,
  updated_at: "2026-09-01",
};
const first = { id: "m1", sender_id: "friend", body: "Hello", created_at: "2026-09-01T12:00:00Z" };
function mount(
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  }),
) {
  return render(
    <QueryClientProvider client={client}>
      <MessagesScreen conversationId="chat" onSelect={vi.fn()} />
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  api.getConversations.mockResolvedValue([conversation]);
  api.getConversation.mockResolvedValue(conversation);
  api.getConversationMessages.mockResolvedValue([first]);
  api.getProfile.mockResolvedValue({ id: "me" });
  api.markConversationRead.mockResolvedValue(undefined);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
it("shows a conversation and preserves the draft after failed sending", async () => {
  api.createMessage.mockRejectedValue(new Error("Offline"));
  mount();
  expect(await screen.findByText("Hello")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Message text"), { target: { value: "Hi Alex" } });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Offline");
  expect(screen.getByLabelText("Message text")).toHaveValue("Hi Alex");
  const attempt = api.createMessage.mock.calls[0][2];
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  await waitFor(() => expect(api.createMessage).toHaveBeenCalledTimes(2));
  expect(api.createMessage.mock.calls[1][2]).toBe(attempt);
});
it("updates the open conversation without reloading the page", async () => {
  mount();
  await screen.findByText("Hello");
  api.getConversationMessages.mockResolvedValue([{ ...first, id: "m2", body: "New reply" }]);
  expect(await screen.findByText("New reply", {}, { timeout: 5000 })).toBeInTheDocument();
  expect(screen.getByText("Hello")).toBeInTheDocument();
});
it("keeps removed friends' history read-only", async () => {
  api.getConversation.mockResolvedValue({ ...conversation, can_message: false });
  mount();
  expect(await screen.findByText("Hello")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Send" })).not.toBeInTheDocument();
  expect(screen.getByText(/read.only/i)).toBeInTheDocument();
});

it("can load older history after revisiting a cached conversation", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(["conversation-has-older", "chat"], true);
  client.setQueryData(["conversation-messages", "chat"], [first]);
  mount(client);
  expect(await screen.findByRole("button", { name: "Older messages" })).toBeInTheDocument();
});
