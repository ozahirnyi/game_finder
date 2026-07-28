import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Avatar } from "@/components/GameCover";
import { Panel, SectionHeader } from "@/components/ui-bits";
import { getFriends } from "@/lib/api";

export const Route = createFileRoute("/friends/$friendId")({ component: FriendPage });

function FriendPage() {
  const { friendId } = Route.useParams();
  const friendsQuery = useQuery({ queryKey: ["friends"], queryFn: getFriends });
  const friend = friendsQuery.data?.find(({ user }) => user.id === friendId)?.user;

  return (
    <AppShell>
      <Link
        to="/friends"
        className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to friends
      </Link>
      {friend ? (
        <Panel className="flex max-w-2xl items-start gap-5 p-7">
          <Avatar
            from="#e85d3a"
            to="#7c2d12"
            name={friend.display_name}
            className="size-16 rounded-2xl"
          />
          <div>
            <SectionHeader title={friend.display_name} hint="Playfinder friend" />
            <p className="text-sm text-muted-foreground">{friend.bio ?? "No public bio yet."}</p>
          </div>
        </Panel>
      ) : (
        <p className="text-sm text-muted-foreground">
          {friendsQuery.isLoading ? "Loading friend…" : "Friend not found."}
        </p>
      )}
    </AppShell>
  );
}
