import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Avatar } from "@/components/GameCover";
import { EmptyState, Panel, SectionHeader } from "@/components/ui-bits";
import { createFriendRequest, getPublicUsers } from "@/lib/api";

export const Route = createFileRoute("/users/")({
  validateSearch: (search: Record<string, unknown>) => ({
    page: typeof search.page === "number" && search.page > 0 ? Math.floor(search.page) : 1,
  }),
  component: UsersPage,
});

export function directoryAction(
  relationship: "none" | "friends" | "outgoing_pending" | "incoming_pending",
  locallyRequested: boolean,
) {
  if (relationship === "friends") return { label: "Friends", enabled: false };
  if (relationship === "incoming_pending") return { label: "Respond to request", enabled: false };
  if (relationship === "outgoing_pending" || locallyRequested) return { label: "Request sent", enabled: false };
  return { label: "Add friend", enabled: true };
}

function UsersPage() {
  const { page } = Route.useSearch();
  const queryClient = useQueryClient();
  const [requestedUserIds, setRequestedUserIds] = useState<Set<string>>(new Set());
  const users = useQuery({
    queryKey: ["public-users", page],
    queryFn: () => getPublicUsers(page),
  });
  const request = useMutation({
    mutationFn: (recipientId: string) => createFriendRequest({ recipient_id: recipientId }),
    onSuccess: (_, recipientId) => {
      setRequestedUserIds((ids) => new Set(ids).add(recipientId));
      void queryClient.invalidateQueries({ queryKey: ["public-users"] });
    },
  });
  const totalPages = Math.ceil((users.data?.total ?? 0) / 10);

  return (
    <AppShell>
      <section className="mx-auto max-w-4xl space-y-6">
        <div>
          <p className="label-mono text-primary">Community</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">All users</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Discover players across Playfinder and connect for your next game.
          </p>
        </div>
        {users.isPending ? (
          <Panel className="p-6">
            <p className="text-sm text-muted-foreground">Loading players…</p>
          </Panel>
        ) : users.isError ? (
          <Panel className="p-6">
            <p className="text-sm text-muted-foreground">Could not load players.</p>
            <button
              type="button"
              onClick={() => void users.refetch()}
              className="mt-4 rounded-lg border border-border px-4 py-2 text-sm font-bold"
            >
              Retry
            </button>
          </Panel>
        ) : users.data?.items.length === 0 ? (
          <EmptyState
            title="No players to show"
            description="Check back later to find more Playfinder players."
          />
        ) : (
          <>
            <div className="space-y-3">
              {users.data?.items.map((user) => {
                const wasRequested = requestedUserIds.has(user.id);
                const isRequesting = request.isPending && request.variables === user.id;
                const action = directoryAction(user.relationship, wasRequested);
                return (
                  <article
                    key={user.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface p-4"
                  >
                    <Link
                      to="/users/$publicId"
                      params={{ publicId: user.public_id }}
                      aria-label={`Open ${user.display_name} profile`}
                      className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-1 py-1 transition hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary/60"
                    >
                      <span aria-label={user.display_name} className="shrink-0">
                        <Avatar
                          from="#7c3aed"
                          to="#111827"
                          name={user.display_name}
                          image={user.avatar ?? undefined}
                          className="size-11 rounded-full"
                        />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-bold">{user.display_name}</span>
                        {user.steam_persona_name && (
                          <span className="block truncate text-xs text-muted-foreground">
                            {user.steam_persona_name}
                          </span>
                        )}
                      </span>
                    </Link>
                    <button
                      type="button"
                      onClick={() => action.enabled && request.mutate(user.id)}
                      disabled={isRequesting || !action.enabled}
                      className="shrink-0 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isRequesting ? "Sending…" : action.label}
                    </button>
                  </article>
                );
              })}
            </div>
            {request.isError && (
              <p role="alert" className="text-sm text-destructive">
                Could not send friend request. Try again.
              </p>
            )}
            {totalPages > 1 && (
              <nav
                aria-label="Player directory pages"
                className="flex flex-wrap items-center gap-2"
              >
                {page > 1 && (
                  <Link
                    to="/users"
                    search={{ page: page - 1 }}
                    className="rounded-md border border-border px-3 py-1.5 text-sm font-semibold"
                  >
                    Previous
                  </Link>
                )}
                {Array.from({ length: totalPages }, (_, index) => index + 1).map((value) => (
                  <Link
                    key={value}
                    to="/users"
                    search={{ page: value }}
                    aria-current={value === page ? "page" : undefined}
                    className={
                      value === page
                        ? "rounded-md bg-primary px-3 py-1.5 text-sm font-bold text-primary-foreground"
                        : "rounded-md border border-border px-3 py-1.5 text-sm font-semibold"
                    }
                  >
                    {value}
                  </Link>
                ))}
                {page < totalPages && (
                  <Link
                    to="/users"
                    search={{ page: page + 1 }}
                    className="rounded-md border border-border px-3 py-1.5 text-sm font-semibold"
                  >
                    Next
                  </Link>
                )}
              </nav>
            )}
          </>
        )}
      </section>
    </AppShell>
  );
}
