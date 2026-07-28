import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Avatar } from "@/components/GameCover";
import { Panel, SectionHeader } from "@/components/ui-bits";
import { getFriends } from "@/lib/api";

export const Route = createFileRoute("/friends/")({ component: FriendsPage });

function FriendsPage() {
  const friendsQuery = useQuery({ queryKey: ["friends"], queryFn: getFriends });
  const friends = friendsQuery.data ?? [];

  return (
    <AppShell>
      <SectionHeader title="Friends" hint={`${friends.length} connected players`} />
      {friendsQuery.isLoading && <p className="text-sm text-muted-foreground">Loading friends…</p>}
      {friendsQuery.isError && (
        <p className="text-sm text-destructive">
          Unable to load friends. Sign in to view your network.
        </p>
      )}
      <div className="stagger grid grid-cols-1 gap-4 md:grid-cols-2">
        {friends.map(({ user }) => (
          <Link key={user.id} to="/friends/$friendId" params={{ friendId: user.id }}>
            <Panel interactive className="flex items-center gap-4 p-5">
              <Avatar
                from="#e85d3a"
                to="#7c2d12"
                name={user.display_name}
                className="size-12 rounded-2xl"
              />
              <div className="min-w-0">
                <h2 className="truncate font-bold">{user.display_name}</h2>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                  {user.bio ?? "No profile description yet."}
                </p>
              </div>
            </Panel>
          </Link>
        ))}
      </div>
      {!friendsQuery.isLoading && !friendsQuery.isError && friends.length === 0 && (
        <Panel className="p-6 text-sm text-muted-foreground">
          Your friend list is empty. Add players through the social API to see them here.
        </Panel>
      )}
    </AppShell>
  );
}
