import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { ErrorState, Skeleton } from "@/components/ui-bits";
import { PublicProfileView } from "@/components/PublicProfileView";
import { getAuthSnapshot, getPublicProfile } from "@/lib/api";

export const Route = createFileRoute("/users/$publicId")({ component: PublicProfilePage });

function PublicProfilePage() {
  const { publicId } = Route.useParams();
  const profileQuery = useQuery({ queryKey: ["public-profile", publicId], queryFn: () => getPublicProfile(publicId) });
  return <AppShell>{profileQuery.isLoading ? <Skeleton className="h-80 w-full" /> : profileQuery.isError || !profileQuery.data ? <ErrorState title="Profile unavailable" description="This profile is no longer available." /> : <PublicProfileView profile={profileQuery.data} isAuthenticated={getAuthSnapshot()} />}</AppShell>;
}
