import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  getSocialMe,
  searchProfiles,
  sendFriendRequest,
  transitionFriendRequest,
} from "@/lib/api";

export function FriendsScreen() {
  const client = useQueryClient();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState("");
  const me = useQuery({ queryKey: ["social", "me"], queryFn: getSocialMe });
  const results = useQuery({
    queryKey: ["social", "search", query],
    queryFn: () => searchProfiles(query),
    enabled: query.trim().length >= 2,
  });
  const send = useMutation({
    mutationFn: sendFriendRequest,
    onSuccess: () => client.invalidateQueries({ queryKey: ["social"] }),
  });
  const transition = useMutation({
    mutationFn: ({
      id,
      action,
    }: {
      id: string;
      action: "accept" | "reject" | "cancel";
    }) => transitionFriendRequest(id, action),
    onSuccess: () => client.invalidateQueries({ queryKey: ["social"] }),
  });
  if (me.isLoading) return <p>Loading friends…</p>;
  if (me.isError)
    return <button onClick={() => me.refetch()}>Retry friends</button>;
  return (
    <section>
      <h1>Friends</h1>
      <p>Your friend code: {me.data.friend_code}</p>
      <label>
        Find by nickname
        <input
          aria-label="Find by nickname"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      {results.data?.map((profile) => (
        <button
          key={profile.profile_id}
          onClick={() => setSelected(profile.profile_id)}
        >
          {profile.display_name}
        </button>
      ))}
      {selected ? (
        <button
          disabled={send.isPending}
          onClick={() => send.mutate({ profile_id: selected })}
        >
          Send friend request
        </button>
      ) : null}
      <h2>Friends</h2>
      {me.data.friends.length ? (
        me.data.friends.map((friend) => (
          <p key={friend.profile_id}>
            <a href={`/users/${friend.profile_id}`}>{friend.display_name}</a>{" "}
            <a href={`/friends/${friend.profile_id}/messages`}>Messages</a>
          </p>
        ))
      ) : (
        <p>No friends yet.</p>
      )}
      <h2>Incoming requests</h2>
      {me.data.incoming.length ? (
        me.data.incoming.map((request) => (
          <p key={request.id}>
            <a href={`/users/${request.profile_id}`}>{request.display_name}</a>{" "}
            <button
              disabled={transition.isPending}
              onClick={() =>
                transition.mutate({ id: request.id, action: "accept" })
              }
            >
              Accept request from {request.display_name}
            </button>{" "}
            <button
              disabled={transition.isPending}
              onClick={() =>
                transition.mutate({ id: request.id, action: "reject" })
              }
            >
              Reject request from {request.display_name}
            </button>
          </p>
        ))
      ) : (
        <p>No incoming requests.</p>
      )}
      <h2>Outgoing requests</h2>
      {me.data.outgoing.length ? (
        me.data.outgoing.map((request) => (
          <p key={request.id}>
            <a href={`/users/${request.profile_id}`}>{request.display_name}</a>{" "}
            <button
              disabled={transition.isPending}
              onClick={() =>
                transition.mutate({ id: request.id, action: "cancel" })
              }
            >
              Cancel request to {request.display_name}
            </button>
          </p>
        ))
      ) : (
        <p>No outgoing requests.</p>
      )}
      <a href="/friends/invites">Game invites</a>
      {send.isError || transition.isError ? (
        <p role="alert">Could not update friends.</p>
      ) : null}
    </section>
  );
}
