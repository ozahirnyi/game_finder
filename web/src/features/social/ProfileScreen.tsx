import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSocialProfile, sendFriendRequest } from "@/lib/api";

export function ProfileScreen({ profileId }: { profileId: string }) {
  const client = useQueryClient();
  const profile = useQuery({
    queryKey: ["social", "profile", profileId],
    queryFn: () => getSocialProfile(profileId),
  });
  const send = useMutation({
    mutationFn: sendFriendRequest,
    onSuccess: () => client.invalidateQueries({ queryKey: ["social"] }),
  });
  if (profile.isLoading) return <p>Loading profile…</p>;
  if (profile.isError)
    return <button onClick={() => profile.refetch()}>Retry profile</button>;
  const data = profile.data;
  return (
    <section>
      <h1>{data.display_name}</h1>
      {data.relationship === "none" ? (
        <button
          disabled={send.isPending}
          onClick={() => send.mutate({ profile_id: data.profile_id })}
        >
          Send friend request
        </button>
      ) : (
        <p>
          {data.relationship === "friends"
            ? "Friends"
            : "Friend request pending"}
        </p>
      )}
      {send.isError ? <p role="alert">Could not send friend request.</p> : null}
    </section>
  );
}
