import {
  type FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { DirectMessage } from "@/lib/api";
import { getDirectMessages, getSocialMe, sendDirectMessage } from "@/lib/api";
import { useAuthState } from "@/hooks/useAuthState";

const cardClass = "rounded-2xl border border-border bg-surface p-5";

function errorMessage(reason: unknown, fallback: string) {
  return reason instanceof Error ? reason.message : fallback;
}

function conversationPath(friendId: string) {
  return `/friends/${encodeURIComponent(friendId)}/messages`;
}

function loginHref(returnTo: string) {
  return `/login?returnTo=${encodeURIComponent(returnTo)}`;
}

function mergeMessages(
  current: DirectMessage[],
  incoming: DirectMessage[],
): DirectMessage[] {
  const messages = new Map(current.map((message) => [message.id, message]));
  for (const message of incoming) messages.set(message.id, message);
  return [...messages.values()].sort((left, right) => {
    const timeDifference =
      new Date(left.created_at).getTime() -
      new Date(right.created_at).getTime();
    return timeDifference || left.id.localeCompare(right.id);
  });
}

export function ConversationScreen({
  friendId,
  initialDraft = "",
}: {
  friendId: string;
  initialDraft?: string;
}) {
  const authenticated = useAuthState();
  const activeFriendId = useRef(friendId);
  activeFriendId.current = friendId;
  const seenCursors = useRef(new Set<string>());
  const [friendName, setFriendName] = useState("Friend");
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [text, setText] = useState(initialDraft);
  const [loading, setLoading] = useState(authenticated);
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const [sending, setSending] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [pollError, setPollError] = useState("");
  const [earlierError, setEarlierError] = useState("");
  const [sendError, setSendError] = useState("");

  const refreshLatest = useCallback(
    async (initial: boolean) => {
      const requestedFriendId = friendId;
      try {
        const page = await getDirectMessages(requestedFriendId);
        if (activeFriendId.current !== requestedFriendId) return;
        setMessages((current) => mergeMessages(current, page.messages));
        if (initial) {
          setNextCursor(page.next_cursor);
          seenCursors.current = new Set(
            page.next_cursor ? [page.next_cursor] : [],
          );
        }
        setLoadError("");
        setPollError("");
      } catch (reason) {
        if (activeFriendId.current !== requestedFriendId) return;
        const messageText = errorMessage(
          reason,
          "Could not load this conversation.",
        );
        if (initial) setLoadError(messageText);
        else setPollError(messageText);
      } finally {
        if (initial && activeFriendId.current === requestedFriendId) {
          setLoading(false);
        }
      }
    },
    [friendId],
  );

  useEffect(() => {
    if (!authenticated) return;
    let active = true;
    setFriendName("Friend");
    getSocialMe()
      .then((social) => {
        if (!active) return;
        const friend = social.friends.find((item) => item.id === friendId);
        setFriendName(friend?.nickname ?? "Friend");
      })
      .catch(() => {
        if (active) setFriendName("Friend");
      });
    return () => {
      active = false;
    };
  }, [authenticated, friendId]);

  useEffect(() => {
    if (!authenticated) return;
    setMessages([]);
    setNextCursor(null);
    setText(initialDraft);
    setLoading(true);
    setLoadingEarlier(false);
    setSending(false);
    setLoadError("");
    setPollError("");
    setEarlierError("");
    setSendError("");
    seenCursors.current = new Set();

    void refreshLatest(true);
    const pollingId = window.setInterval(() => {
      void refreshLatest(false);
    }, 15_000);

    return () => {
      window.clearInterval(pollingId);
    };
  }, [authenticated, friendId, initialDraft, refreshLatest]);

  async function loadEarlier() {
    const cursor = nextCursor;
    const requestedFriendId = friendId;
    if (!cursor || loadingEarlier) return;
    setLoadingEarlier(true);
    setEarlierError("");
    try {
      const page = await getDirectMessages(requestedFriendId, cursor);
      if (activeFriendId.current !== requestedFriendId) return;
      setMessages((current) => mergeMessages(current, page.messages));
      if (page.next_cursor && seenCursors.current.has(page.next_cursor)) {
        setNextCursor(null);
        setEarlierError("Conversation pagination returned a repeated cursor.");
      } else {
        if (page.next_cursor) seenCursors.current.add(page.next_cursor);
        setNextCursor(page.next_cursor);
      }
    } catch (reason) {
      if (activeFriendId.current === requestedFriendId) {
        setEarlierError(
          errorMessage(reason, "Could not load earlier messages."),
        );
      }
    } finally {
      if (activeFriendId.current === requestedFriendId) {
        setLoadingEarlier(false);
      }
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const messageText = text.trim();
    const requestedFriendId = friendId;
    if (!messageText || sending || loadError) return;
    setSending(true);
    setSendError("");
    try {
      await sendDirectMessage(requestedFriendId, messageText);
      if (activeFriendId.current !== requestedFriendId) return;
      setText("");
      await refreshLatest(false);
    } catch (reason) {
      if (activeFriendId.current === requestedFriendId) {
        setSendError(errorMessage(reason, "Could not send this message."));
      }
    } finally {
      if (activeFriendId.current === requestedFriendId) setSending(false);
    }
  }

  if (!authenticated) {
    return (
      <article className={cardClass}>
        <h1 className="text-2xl font-bold">Sign in to open messages</h1>
        <a
          className="mt-5 inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
          href={loginHref(conversationPath(friendId))}
        >
          Sign in
        </a>
      </article>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <p className="font-mono text-xs uppercase tracking-widest text-primary">
          Private conversation
        </p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight">
          {friendName}
        </h1>
      </header>

      {loading ? (
        <p role="status" className="text-sm text-muted-foreground">
          Loading messages…
        </p>
      ) : null}

      {loadError ? (
        <div className={cardClass}>
          <h2 className="font-bold">Conversation unavailable</h2>
          <p role="alert" className="mt-1 text-sm text-destructive">
            {loadError}
          </p>
          <button
            className="mt-4 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground"
            onClick={() => void refreshLatest(true)}
            type="button"
          >
            Retry
          </button>
        </div>
      ) : !loading && messages.length === 0 ? (
        <div className={cardClass}>
          <p className="text-sm text-muted-foreground">
            No messages yet. Start the conversation below.
          </p>
        </div>
      ) : (
        <>
          {nextCursor ? (
            <button
              className={secondaryButtonClass}
              disabled={loadingEarlier}
              onClick={() => void loadEarlier()}
              type="button"
            >
              {loadingEarlier ? "Loading earlier…" : "Load earlier"}
            </button>
          ) : null}
          {earlierError ? (
            <p role="alert" className="text-sm text-destructive">
              {earlierError}
            </p>
          ) : null}
          <ol aria-label="Message history" className="space-y-3">
            {messages.map((item) => (
              <li key={item.id} className={cardClass}>
                <p className="whitespace-pre-wrap break-words text-sm">
                  {item.text}
                </p>
                <time
                  className="mt-2 block font-mono text-[10px] text-muted-foreground"
                  dateTime={item.created_at}
                >
                  {new Date(item.created_at).toLocaleString()}
                </time>
              </li>
            ))}
          </ol>
        </>
      )}

      {pollError ? (
        <p role="alert" className="text-sm text-destructive">
          Messages may be out of date. {pollError}
        </p>
      ) : null}

      <form className={cardClass} onSubmit={(event) => void submit(event)}>
        <label className="text-sm font-bold" htmlFor="direct-message">
          Message
        </label>
        <textarea
          id="direct-message"
          className="mt-2 min-h-24 w-full rounded-lg border border-border bg-background p-3 text-sm outline-none focus:border-primary disabled:opacity-60"
          disabled={Boolean(loadError)}
          maxLength={2000}
          onChange={(event) => setText(event.target.value)}
          placeholder="Write a message…"
          value={text}
        />
        <div className="mt-3 flex items-center justify-between gap-4">
          <span className="font-mono text-[10px] text-muted-foreground">
            {text.length}/2000
          </span>
          <button
            className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50"
            disabled={sending || !text.trim() || Boolean(loadError)}
            type="submit"
          >
            {sending ? "Sending…" : "Send message"}
          </button>
        </div>
        {sendError ? (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {sendError}
          </p>
        ) : null}
      </form>
    </div>
  );
}

const secondaryButtonClass =
  "rounded-lg border border-border bg-surface px-3 py-2 text-xs font-bold disabled:opacity-50";
