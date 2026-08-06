import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { getSocialMe, searchProfiles, sendFriendRequest } from "@/lib/api";

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
          <p key={friend.profile_id}>{friend.display_name}</p>
        ))
      ) : (
        <p>No friends yet.</p>
      )}
      <h2>Incoming requests</h2>
      {me.data.incoming.length ? (
        me.data.incoming.map((request) => (
          <p key={request.id}>{request.display_name}</p>
        ))
      ) : (
        <p>No incoming requests.</p>
      )}
    </section>
  );
}
