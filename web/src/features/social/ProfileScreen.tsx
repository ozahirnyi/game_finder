import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getPublicProfile,
  isAuthenticated,
  sendFriendRequest,
  type PublicProfileBlock,
} from "@/lib/api";

function Block({ title, block }: { title: string; block: PublicProfileBlock }) {
  if (block.state === "hidden")
    return (
      <section>
        <h2>{title}</h2>
        <p>{block.message ?? "This section is private."}</p>
      </section>
    );
  if (block.state === "empty")
    return (
      <section>
        <h2>{title}</h2>
        <p>Nothing to show yet.</p>
      </section>
    );
  return (
    <section>
      <h2>{title}</h2>
      {block.items?.map((item) => (
        <p key={item.id ?? item.persona_name}>
          {item.title ?? item.persona_name}
        </p>
      ))}
    </section>
  );
}

export function ProfileScreen({ profileId }: { profileId: string }) {
  const client = useQueryClient();
  const profile = useQuery({
    queryKey: ["public-profile", profileId],
    queryFn: () => getPublicProfile(profileId),
  });
  const send = useMutation({
    mutationFn: sendFriendRequest,
    onSuccess: () =>
      client.invalidateQueries({ queryKey: ["public-profile", profileId] }),
  });
  if (profile.isLoading) return <p>Loading profile…</p>;
  if (profile.isError)
    return <button onClick={() => profile.refetch()}>Retry profile</button>;
  const data = profile.data;
  return (
    <section>
      <h1>{data.display_name}</h1>
      {isAuthenticated() && data.relationship === "none" ? (
        <button
          disabled={send.isPending}
          onClick={() => send.mutate({ profile_id: data.profile_id })}
        >
          Send friend request
        </button>
      ) : null}
      {data.relationship === "self" ? (
        <a href="/profile">Edit privacy settings</a>
      ) : null}
      {send.isError ? <p role="alert">Could not send friend request.</p> : null}
      <Block title="Library" block={data.library} />
      <Block title="Favorites" block={data.favorites} />
      <Block title="Wishlist" block={data.wishlist} />
      <Block title="Steam" block={data.steam} />
    </section>
  );
}
