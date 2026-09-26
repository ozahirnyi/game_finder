import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({
  getConversations: vi.fn(),
  getConversation: vi.fn(),
  getConversationMessages: vi.fn(),
  createMessage: vi.fn(),
  markConversationRead: vi.fn(),
  respondToGameInvite: vi.fn(),
  getProfile: vi.fn(),
  getAuthSnapshot: vi.fn(),
}));
vi.mock("@/lib/api", async () => ({ ...(await vi.importActual("@/lib/api")), ...api }));
vi.mock("@/components/UserProfileLink", () => ({
  UserProfileLink: ({ publicId, children }: { publicId: string; children: React.ReactNode }) => (
    <a href={`/users/${publicId}`}>{children}</a>
  ),
}));
import { MessagesScreen } from "./MessagesScreen";
const conversation = {
  id: "chat",
  participant: {
    id: "friend",
    public_id: "alex-public",
    display_name: "76561198000000001",
    steam_persona_name: "Alex",
    avatar: "https://avatar.test/alex.png",
  },
  can_message: true,
  updated_at: "2026-09-01",
};
const first = { id: "m1", sender_id: "friend", body: "Hello", created_at: "2026-09-01T12:00:00Z" };
function mount(
  conversationId: string | undefined = "chat",
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  }),
) {
  const onSelect = vi.fn();
  const rendered = render(
    <QueryClientProvider client={client}>
      <MessagesScreen conversationId={conversationId} onSelect={onSelect} />
    </QueryClientProvider>,
  );
  return { ...rendered, onSelect };
}
beforeEach(() => {
  vi.clearAllMocks();
  api.getConversations.mockResolvedValue([conversation]);
  api.getConversation.mockResolvedValue(conversation);
  api.getConversationMessages.mockResolvedValue([first]);
  api.getProfile.mockResolvedValue({ id: "me" });
  api.markConversationRead.mockResolvedValue(undefined);
  api.respondToGameInvite.mockResolvedValue({ id: "invite-1", status: "accepted" });
  api.getAuthSnapshot.mockReturnValue(true);
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
it("sends on Enter and leaves Shift+Enter available for a new line", async () => {
  mount();
  await screen.findByText("Hello");
  const composer = screen.getByLabelText("Message text");
  fireEvent.change(composer, { target: { value: "Hi Alex" } });

  expect(fireEvent.keyDown(composer, { key: "Enter", code: "Enter" })).toBe(false);
  await waitFor(() =>
    expect(api.createMessage).toHaveBeenCalledWith("chat", "Hi Alex", expect.any(String)),
  );

  api.createMessage.mockClear();
  expect(fireEvent.keyDown(composer, { key: "Enter", code: "Enter", shiftKey: true })).toBe(true);
  expect(api.createMessage).not.toHaveBeenCalled();
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
  mount("chat", client);
  expect(await screen.findByRole("button", { name: "Older messages" })).toBeInTheDocument();
});

it("keeps a short conversation stretched to the full chat viewport", async () => {
  mount();
  const log = await screen.findByRole("log", { name: "Conversation history" });
  expect(log).toHaveClass("min-h-0");
  expect(log.closest("section")).toHaveClass("h-full");
  expect(log.closest("#messages-screen")).toHaveClass("lg:h-screen");
});

it("uses the Steam persona name throughout the conversation UI", async () => {
  mount();
  expect(await screen.findAllByText("Alex")).not.toHaveLength(0);
  expect(screen.queryByText("76561198000000001")).not.toBeInTheDocument();
});

it("links the active chat participant to their profile and shows their avatar", async () => {
  const { onSelect } = mount();

  const heading = await screen.findByText("Alex", { selector: "h2" });
  const header = heading.parentElement;
  expect(header).not.toBeNull();
  const profile = within(header!).getByRole("link", { name: "Alex" });
  expect(profile).toHaveAttribute("href", "/users/alex-public");
  const avatar = header!.querySelector("img");
  expect(avatar).toHaveAttribute("src", "https://avatar.test/alex.png");
  expect(avatar?.closest("a")).toBe(profile);
  fireEvent.click(profile);
  expect(onSelect).not.toHaveBeenCalled();
});

it("selects the conversation from its list row without linking to the profile", async () => {
  const { onSelect } = mount(undefined);

  const chats = screen.getByRole("heading", { name: "Chats" }).parentElement;
  expect(chats).not.toBeNull();
  await within(chats!).findByText("Alex");
  expect(within(chats!).queryByRole("link", { name: "Alex" })).not.toBeInTheDocument();
  expect(within(chats!).getByAltText("Alex")).toHaveAttribute(
    "src",
    "https://avatar.test/alex.png",
  );

  const conversationCard = within(chats!).getByRole("button", {
    name: "Open conversation with Alex",
  });
  fireEvent.click(within(conversationCard).getByAltText("Alex"));
  expect(onSelect).toHaveBeenCalledWith("chat");

  onSelect.mockClear();
  fireEvent.click(within(conversationCard).getByText("Alex"));
  expect(onSelect).toHaveBeenCalledWith("chat");
});

it("renders a pending game invite card and lets its recipient accept it", async () => {
  const inviteMessage = {
    id: "invite-message",
    sender_id: "friend",
    body: "Game invitation: Portal",
    kind: "game_invite" as const,
    created_at: "2026-09-01T12:00:00Z",
    game_invite: {
      id: "invite-1",
      game_name: "Portal",
      note: "Tonight?",
      status: "pending" as const,
      sender_id: "friend",
      sender_name: "Alex",
      recipient_id: "me",
      recipient_name: "Me",
    },
  };
  api.getConversationMessages.mockResolvedValue([inviteMessage]);
  let finishResponse!: () => void;
  api.respondToGameInvite.mockReturnValue(
    new Promise((resolve) => {
      finishResponse = () => resolve({ id: "invite-1", status: "accepted" });
    }),
  );
  mount();
  expect(await screen.findByText("Game invite")).toBeInTheDocument();
  expect(screen.getByText("Portal")).toBeInTheDocument();
  expect(screen.getByText("Tonight?")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Accept" }));
  await waitFor(() => expect(api.respondToGameInvite).toHaveBeenCalledWith("invite-1", "accepted"));
  expect(screen.getByRole("button", { name: "Decline" })).toBeDisabled();
  finishResponse();
});

it("shows invite outcome and system response message after a response", async () => {
  const pending = {
    id: "invite-message",
    sender_id: "friend",
    body: "Game invitation: Portal",
    kind: "game_invite" as const,
    created_at: "2026-09-01T12:00:00Z",
    game_invite: {
      id: "invite-1",
      game_name: "Portal",
      status: "pending" as const,
      sender_id: "friend",
      sender_name: "Alex",
      recipient_id: "me",
      recipient_name: "Me",
    },
  };
  api.getConversationMessages.mockResolvedValueOnce([pending]).mockResolvedValue([
    { ...pending, game_invite: { ...pending.game_invite, status: "accepted" as const } },
    {
      id: "system-1",
      sender_id: "me",
      body: "Me accepted the invitation to Portal.",
      kind: "system" as const,
      created_at: "2026-09-01T12:01:00Z",
    },
  ]);
  mount();
  fireEvent.click(await screen.findByRole("button", { name: "Accept" }));
  expect(await screen.findByText("Accepted")).toBeInTheDocument();
  expect(await screen.findByText("Me accepted the invitation to Portal.")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Accept" })).not.toBeInTheDocument();
});

it("does not show response buttons to the sender or for a completed invite", async () => {
  const card = {
    id: "invite-message",
    sender_id: "me",
    body: "Game invitation: Portal",
    kind: "game_invite" as const,
    created_at: "2026-09-01T12:00:00Z",
    game_invite: {
      id: "invite-1",
      game_name: "Portal",
      status: "pending" as const,
      sender_id: "me",
      sender_name: "Me",
      recipient_id: "friend",
      recipient_name: "Alex",
    },
  };
  api.getConversationMessages.mockResolvedValue([card]);
  mount();
  expect(await screen.findByText("Pending")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Accept" })).not.toBeInTheDocument();
  cleanup();

  api.getConversationMessages.mockResolvedValue([
    {
      ...card,
      sender_id: "friend",
      game_invite: { ...card.game_invite, status: "declined" as const },
    },
  ]);
  mount();
  expect(await screen.findByText("Declined")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Accept" })).not.toBeInTheDocument();
});

it("keeps a pending invite actionable and shows a neutral error when responding fails", async () => {
  api.getConversationMessages.mockResolvedValue([
    {
      id: "invite-message",
      sender_id: "friend",
      body: "Game invitation: Portal",
      kind: "game_invite" as const,
      created_at: "2026-09-01T12:00:00Z",
      game_invite: {
        id: "invite-1",
        game_name: "Portal",
        status: "pending" as const,
        sender_id: "friend",
        sender_name: "Alex",
        recipient_id: "me",
        recipient_name: "Me",
      },
    },
  ]);
  api.respondToGameInvite.mockRejectedValue(new Error("invite unavailable"));
  mount();
  fireEvent.click(await screen.findByRole("button", { name: "Decline" }));

  expect(await screen.findByRole("alert")).toHaveTextContent("Could not respond to this invite.");
  expect(screen.getByRole("button", { name: "Accept" })).toBeEnabled();
  expect(screen.getByRole("button", { name: "Decline" })).toBeEnabled();
});

it("shows a new-account empty state instead of a conversation picker", async () => {
  api.getConversations.mockResolvedValue([]);
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <MessagesScreen onSelect={vi.fn()} />
    </QueryClientProvider>,
  );
  expect(
    await screen.findByText("No conversations yet. Open a friend's profile to start a chat."),
  ).toBeInTheDocument();
  expect(screen.queryByText("Choose a conversation")).not.toBeInTheDocument();
});

it("asks signed-out visitors to sign in without loading conversations", () => {
  api.getAuthSnapshot.mockReturnValue(false);
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <MessagesScreen onSelect={vi.fn()} />
    </QueryClientProvider>,
  );
  expect(screen.getByText("Sign in to view chats.")).toBeInTheDocument();
  expect(screen.queryByText(/Loading conversations/)).not.toBeInTheDocument();
  expect(screen.queryByText("Choose a conversation")).not.toBeInTheDocument();
  expect(api.getConversations).not.toHaveBeenCalled();
});
