import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { MessagesScreen } from "@/components/MessagesScreen";
import { createConversation } from "@/lib/api";

export const Route = createFileRoute("/messages/")({
  validateSearch: (search: Record<string, unknown>): { friend?: string } =>
    typeof search.friend === "string" ? { friend: search.friend } : {},
  head: () => ({ meta: [{ title: "Messages — Playfinder" }] }),
  component: MessagesPage,
});
function MessagesPage() {
  const { friend } = Route.useSearch();
  const navigate = useNavigate();
  const requested = useRef("");
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!friend || requested.current === `${friend}:${attempt}`) return;
    requested.current = `${friend}:${attempt}`;
    setError("");
    void createConversation(friend)
      .then((conversation) =>
        navigate({
          to: "/messages/$conversationId",
          params: { conversationId: conversation.id },
          replace: true,
        }),
      )
      .catch((reason: Error) => setError(reason.message));
  }, [attempt, friend, navigate]);
  return (
    <AppShell>
      {friend ? (
        error ? (
          <div role="alert">
            <p>Could not open chat. {error}</p>
            <button onClick={() => setAttempt((value) => value + 1)}>Retry opening chat</button>
          </div>
        ) : (
          <p role="status">Opening chat…</p>
        )
      ) : (
        <MessagesScreen
          onSelect={(id) => {
            if (id)
              void navigate({ to: "/messages/$conversationId", params: { conversationId: id } });
          }}
        />
      )}
    </AppShell>
  );
}
