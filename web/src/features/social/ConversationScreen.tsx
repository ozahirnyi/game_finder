import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  ApiError,
  createGameInvite,
  listMessages,
  searchGames,
  sendMessage,
} from "@/lib/api";

export function ConversationScreen({ friendId }: { friendId: string }) {
  const client = useQueryClient();
  const [text, setText] = useState("");
  const [gameQuery, setGameQuery] = useState("");
  const messages = useQuery({
    queryKey: ["social", "messages", friendId],
    queryFn: () => listMessages(friendId),
  });
  const send = useMutation({
    mutationFn: (message: string) => sendMessage(friendId, { text: message }),
    onSuccess: () => {
      setText("");
      void client.invalidateQueries({
        queryKey: ["social", "messages", friendId],
      });
    },
  });
  const games = useQuery({
    queryKey: ["catalog", "search", gameQuery],
    queryFn: () => searchGames(gameQuery),
    enabled: gameQuery.trim().length >= 2,
  });
  const invite = useMutation({
    mutationFn: (game: { id: number; name: string }) =>
      createGameInvite(friendId, {
        game_id: String(game.id),
        game_title: game.name,
      }),
    onSuccess: () => {
      setGameQuery("");
      void client.invalidateQueries({ queryKey: ["social", "invites"] });
    },
  });
  if (messages.isLoading) return <p>Loading conversation…</p>;
  if (messages.isError) {
    const message =
      messages.error instanceof ApiError && messages.error.status === 403
        ? "This conversation is private."
        : "This conversation is unavailable.";
    return (
      <section>
        <p role="alert">{message}</p>
        <button onClick={() => messages.refetch()}>Retry conversation</button>
      </section>
    );
  }
  const trimmed = text.trim();
  return (
    <section>
      <h1>Conversation</h1>
      {messages.data.length ? (
        <ul>
          {messages.data.map((message) => (
            <li key={message.id}>{message.text}</li>
          ))}
        </ul>
      ) : (
        <p>No messages yet.</p>
      )}
      <label>
        Message
        <textarea
          aria-label="Message"
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
      </label>
      <button
        disabled={!trimmed || send.isPending}
        onClick={() => send.mutate(trimmed)}
      >
        Send
      </button>
      {send.isError ? <p role="alert">Could not send message.</p> : null}
      <h2>Invite to a game</h2>
      <label>
        Find a game to invite
        <input
          aria-label="Find a game to invite"
          value={gameQuery}
          onChange={(event) => setGameQuery(event.target.value)}
        />
      </label>
      {games.data?.results
        .filter(
          (game): game is { id: number; name: string } =>
            game.id !== null && game.name !== null,
        )
        .map((game) => (
          <button
            key={game.id}
            disabled={invite.isPending}
            onClick={() => invite.mutate(game)}
          >
            Invite to {game.name}
          </button>
        ))}
      {games.isError || invite.isError ? (
        <p role="alert">Could not load or send a game invite.</p>
      ) : null}
    </section>
  );
}
