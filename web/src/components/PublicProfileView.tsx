import type { ReactNode } from "react";
import { useMutation } from "@tanstack/react-query";
import { createSocialFriendRequest, type PublicDataBlock, type PublicProfile } from "@/lib/api";
import { EmptyState, Panel, SectionHeader } from "@/components/ui-bits";

function Section<T>({
  title,
  block,
  render,
}: {
  title: string;
  block: PublicDataBlock<T>;
  render: (data: T) => ReactNode;
}) {
  if (block.status === "hidden")
    return <EmptyState title={title} description="This section is private." />;
  if (block.status === "empty")
    return <EmptyState title={title} description={block.message ?? "Nothing to show yet."} />;
  return (
    <section>
      <SectionHeader title={title} />
      {render(block.data)}
    </section>
  );
}

export function PublicProfileView({
  profile,
  isAuthenticated,
}: {
  profile: PublicProfile;
  isAuthenticated: boolean;
}) {
  const friendRequest = useMutation({
    mutationFn: () => createSocialFriendRequest(profile.public_id),
  });
  return (
    <div className="space-y-6">
      <Panel className="p-6">
        <h1 className="text-2xl font-bold">{profile.nickname}</h1>
      </Panel>
      <Section
        title="Library"
        block={profile.library}
        render={(games) => (
          <ul>
            {games.map((game) => (
              <li key={game.id}>{game.title}</li>
            ))}
          </ul>
        )}
      />
      <Section
        title="Favorites"
        block={profile.favorites}
        render={(games) => (
          <ul>
            {games.map((game) => (
              <li key={game.id}>{game.title}</li>
            ))}
          </ul>
        )}
      />
      <Section
        title="Wishlist"
        block={profile.wishlist}
        render={(games) => (
          <ul>
            {games.map((game) => (
              <li key={game.id}>{game.title}</li>
            ))}
          </ul>
        )}
      />
      <Section
        title="Steam"
        block={profile.steam}
        render={(steam) => <p>{steam?.persona_name ?? "Steam is not connected."}</p>}
      />
      {profile.relationship === "self" && <a href="/account">Profile settings</a>}
      {isAuthenticated && profile.relationship === "none" && (
        <button
          type="button"
          disabled={friendRequest.isPending}
          onClick={() => friendRequest.mutate()}
        >
          {friendRequest.isPending ? "Sending…" : "Add friend"}
        </button>
      )}
      {friendRequest.isError && <p role="alert">Could not send friend request.</p>}
    </div>
  );
}
