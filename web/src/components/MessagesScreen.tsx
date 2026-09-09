import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createMessage,
  getConversation,
  getConversationMessages,
  getConversations,
  getProfile,
  markConversationRead,
  type ConversationMessage,
} from "@/lib/api";

const button = "rounded-lg border border-border px-3 py-2 text-sm font-bold disabled:opacity-50";
function useVisible() {
  const [visible, setVisible] = useState(
    () => typeof document === "undefined" || document.visibilityState !== "hidden",
  );
  useEffect(() => {
    const update = () => setVisible(document.visibilityState !== "hidden");
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  return visible;
}
function mergeMessages(current: ConversationMessage[], incoming: ConversationMessage[]) {
  return [
    ...new Map([...current, ...incoming].map((message) => [message.id, message])).values(),
  ].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
}

export function MessagesScreen({
  conversationId,
  onSelect,
}: {
  conversationId?: string;
  onSelect: (id?: string) => void;
}) {
  const visible = useVisible();
  const [limit, setLimit] = useState(20);
  const conversations = useQuery({
    queryKey: ["conversations", limit],
    queryFn: () => getConversations(limit),
    refetchInterval: visible ? 3000 : false,
    refetchOnWindowFocus: "always",
  });
  return (
    <div className="grid min-h-[70vh] gap-5 md:grid-cols-[280px_minmax(0,1fr)]">
      <aside
        className={`${conversationId ? "hidden md:block" : ""} rounded-2xl border border-border bg-surface p-4`}
      >
        <h1 className="mb-4 text-2xl font-bold">Messages</h1>
        {conversations.isPending && <p role="status">Loading conversations…</p>}
        {conversations.isError && (
          <p role="alert">
            Could not load conversations.{" "}
            <button className={button} onClick={() => void conversations.refetch()}>
              Retry conversations
            </button>
          </p>
        )}
        {conversations.data?.length === 0 && (
          <p className="text-muted-foreground">
            No conversations yet. Open a friend's profile to start a chat.
          </p>
        )}
        <div className="space-y-2">
          {conversations.data?.map((conversation) => (
            <button
              key={conversation.id}
              onClick={() => onSelect(conversation.id)}
              aria-current={conversation.id === conversationId ? "page" : undefined}
              className={`block w-full rounded-xl p-3 text-left ${conversation.id === conversationId ? "bg-primary/15" : "bg-surface-2"}`}
            >
              <span className="font-bold">{conversation.participant.display_name}</span>
              {!!conversation.unread_count && (
                <span
                  className="ml-2 rounded-full bg-primary px-2 text-xs text-primary-foreground"
                  aria-label={`${conversation.unread_count} unread messages`}
                >
                  {conversation.unread_count}
                </span>
              )}
              <span className="mt-1 block truncate text-sm text-muted-foreground">
                {conversation.last_message ?? "Start a conversation"}
              </span>
            </button>
          ))}
        </div>
        {conversations.data && conversations.data.length >= limit && (
          <button className={`${button} mt-3`} onClick={() => setLimit((value) => value + 20)}>
            More conversations
          </button>
        )}
      </aside>
      {conversationId ? (
        <ConversationThread
          key={conversationId}
          id={conversationId}
          visible={visible}
          onBack={() => onSelect()}
        />
      ) : (
        <p className="hidden place-self-center text-muted-foreground md:block">
          Choose a conversation
        </p>
      )}
    </div>
  );
}

function ConversationThread({
  id,
  visible,
  onBack,
}: {
  id: string;
  visible: boolean;
  onBack: () => void;
}) {
  const client = useQueryClient();
  const key = ["conversation-messages", id];
  const [draft, setDraft] = useState("");
  const [canLoadOlder, setCanLoadOlder] = useState(
    () => client.getQueryData<boolean>(["conversation-has-older", id]) ?? false,
  );
  const rememberOlder = (value: boolean) => {
    setCanLoadOlder(value);
    client.setQueryData(["conversation-has-older", id], value);
  };
  const [newBelow, setNewBelow] = useState(false);
  const [readAttempt, setReadAttempt] = useState(0);
  const viewport = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const lastRead = useRef("");
  const retryAttempt = useRef<{ body: string; id: string } | null>(null);
  const conversation = useQuery({
    queryKey: ["conversation", id],
    queryFn: () => getConversation(id),
    refetchInterval: visible ? 3000 : false,
  });
  const me = useQuery({ queryKey: ["profile"], queryFn: getProfile });
  const messages = useQuery({
    queryKey: key,
    enabled: conversation.isSuccess && visible,
    refetchInterval: visible ? 3000 : false,
    refetchOnWindowFocus: "always",
    queryFn: async () => {
      let accumulated =
        client.getQueryData<ConversationMessage[]>(["conversation-messages", id]) ?? [];
      const initial = accumulated.length === 0;
      for (let page = 0; page < 20; page++) {
        const incoming = await getConversationMessages(
          id,
          accumulated.length ? { after_id: accumulated.at(-1)!.id } : {},
        );
        if (initial && page === 0) rememberOlder(incoming.length === 50);
        const previousLast = accumulated.at(-1)?.id;
        accumulated = mergeMessages(accumulated, incoming);
        if (initial || incoming.length < 50 || previousLast === accumulated.at(-1)?.id) break;
      }
      return mergeMessages(
        client.getQueryData<ConversationMessage[]>(["conversation-messages", id]) ?? [],
        accumulated,
      );
    },
  });
  const older = useMutation({
    mutationFn: async () => {
      const first = messages.data?.[0];
      if (!first) return;
      const container = viewport.current;
      const height = container?.scrollHeight ?? 0;
      const incoming = await getConversationMessages(id, { before_id: first.id });
      rememberOlder(incoming.length === 50);
      client.setQueryData<ConversationMessage[]>(key, (current = []) =>
        mergeMessages(current, incoming),
      );
      requestAnimationFrame(() => {
        if (container) container.scrollTop += container.scrollHeight - height;
      });
    },
  });
  const send = useMutation({
    retry: false,
    mutationFn: ({ body, attempt }: { body: string; attempt: string }) =>
      createMessage(id, body, attempt),
    onSuccess: (message, variables) => {
      client.setQueryData<ConversationMessage[]>(key, (current = []) =>
        mergeMessages(current, [message]),
      );
      setDraft((current) => (current.trim() === variables.body ? "" : current));
      retryAttempt.current = null;
      atBottom.current = true;
      void client.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
  const newest = messages.data?.at(-1)?.id;
  useEffect(() => {
    if (!newest) return;
    if (atBottom.current && viewport.current) {
      viewport.current.scrollTop = viewport.current.scrollHeight;
      setNewBelow(false);
    } else setNewBelow(true);
  }, [newest]);
  useEffect(() => {
    const incoming = messages.data?.filter((message) => message.sender_id !== me.data?.id).at(-1);
    if (!visible || !me.data || !incoming || incoming.id === lastRead.current) return;
    let active = true;
    let retryTimer: number | undefined;
    void markConversationRead(id, incoming.id)
      .then(() => {
        if (active) {
          lastRead.current = incoming.id;
          void client.invalidateQueries({ queryKey: ["conversations"] });
          void client.invalidateQueries({ queryKey: ["notifications"] });
        }
      })
      .catch(() => {
        /* Retry even when a poll returns the same message array. */
        retryTimer = window.setTimeout(() => setReadAttempt((value) => value + 1), 3000);
      });
    return () => {
      active = false;
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
    };
  }, [client, id, me.data, messages.data, messages.dataUpdatedAt, readAttempt, visible]);
  if (conversation.isError)
    return (
      <section role="alert" className="rounded-2xl border border-border p-6">
        <button className={button} onClick={onBack}>
          Back to messages
        </button>
        <p className="my-4">Conversation unavailable.</p>
        <button className={button} onClick={() => void conversation.refetch()}>
          Retry
        </button>
      </section>
    );
  return (
    <section className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-surface">
      <header className="flex items-center gap-3 border-b border-border p-4">
        <button className={`${button} md:hidden`} onClick={onBack}>
          Back
        </button>
        <h2 className="text-xl font-bold">
          {conversation.data?.participant.display_name ?? "Loading chat…"}
        </h2>
      </header>
      <div
        ref={viewport}
        role="log"
        aria-label="Conversation history"
        aria-live="polite"
        className="max-h-[60vh] min-h-64 flex-1 space-y-3 overflow-y-auto p-4"
        onScroll={() => {
          const el = viewport.current;
          if (el) atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
          if (atBottom.current) setNewBelow(false);
        }}
      >
        {canLoadOlder && (
          <button className={button} disabled={older.isPending} onClick={() => older.mutate()}>
            Older messages
          </button>
        )}
        {older.isError && <p role="alert">Could not load older messages. Try again.</p>}
        {messages.isPending && <p role="status">Loading messages…</p>}
        {messages.isError && (
          <p role="alert">
            Could not refresh messages.{" "}
            <button onClick={() => void messages.refetch()}>Retry messages</button>
          </p>
        )}
        {messages.data?.length === 0 && (
          <p className="text-muted-foreground">No messages yet. Say hello.</p>
        )}
        {messages.data?.map((message) => (
          <article
            key={message.id}
            className={`max-w-[85%] rounded-2xl px-4 py-3 ${message.sender_id === me.data?.id ? "ml-auto bg-primary/15" : "bg-surface-2"}`}
          >
            <p className="mb-1 text-xs font-bold text-muted-foreground">
              {message.sender_id === me.data?.id
                ? "You"
                : conversation.data?.participant.display_name}
            </p>
            <p className="whitespace-pre-wrap break-words">{message.body}</p>
            <time
              className="mt-1 block text-xs text-muted-foreground"
              dateTime={message.created_at}
            >
              {new Date(message.created_at).toLocaleString()}
            </time>
          </article>
        ))}
      </div>
      {newBelow && (
        <button
          className={button}
          onClick={() => {
            atBottom.current = true;
            if (viewport.current) viewport.current.scrollTop = viewport.current.scrollHeight;
            setNewBelow(false);
          }}
        >
          New messages ↓
        </button>
      )}
      {conversation.data?.can_message === false ? (
        <p className="border-t border-border p-4 text-muted-foreground">
          This conversation is read-only. You are no longer friends.
        </p>
      ) : (
        conversation.isSuccess && (
          <form
            className="border-t border-border p-4"
            onSubmit={(event) => {
              event.preventDefault();
              const body = draft.trim();
              if (!body || send.isPending) return;
              if (retryAttempt.current?.body !== body)
                retryAttempt.current = { body, id: crypto.randomUUID() };
              send.mutate({ body, attempt: retryAttempt.current!.id });
            }}
          >
            <label htmlFor={`message-${id}`} className="sr-only">
              Message text
            </label>
            <textarea
              id={`message-${id}`}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              maxLength={2000}
              rows={3}
              placeholder="Write a message…"
              className="w-full resize-y rounded-xl border border-border bg-surface-2 p-3"
            />
            {send.isError && (
              <p role="alert" className="py-2 text-destructive">
                {send.error.message || "Could not send message. Try again."}
              </p>
            )}
            <div className="mt-2 flex justify-end">
              <button
                className={`${button} bg-primary text-primary-foreground`}
                disabled={!draft.trim() || send.isPending}
              >
                {send.isPending ? "Sending…" : "Send"}
              </button>
            </div>
          </form>
        )
      )}
    </section>
  );
}
