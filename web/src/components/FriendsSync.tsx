import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getBlockedUsers, syncSteamFriends, unblockUser } from "@/lib/api";

export function FriendsSync() {
  const client = useQueryClient();
  const started = useRef(false);
  const sync = useMutation({
    mutationFn: (force: boolean) => syncSteamFriends(force),
    onSuccess: (result) => {
      if (result.added) {
        void client.invalidateQueries({ queryKey: ["friends"] });
        void client.invalidateQueries({ queryKey: ["friend-requests"] });
      }
    },
  });
  const run = sync.mutate;
  useEffect(() => {
    if (!started.current) {
      started.current = true;
      run(false);
    }
  }, [run]);
  return (
    <div className="mb-4 rounded-xl border border-border p-3 text-sm">
      <p role="status">
        {sync.isPending
          ? "Checking Steam contacts on Playfinder…"
          : sync.isError
            ? "Could not sync Steam contacts."
            : (sync.data?.message ??
              (sync.data?.added
                ? `${sync.data.added} Steam contacts added to your friends.`
                : "Steam contacts on Playfinder are added automatically."))}
      </p>
      {(sync.isError || sync.data?.status === "unavailable") && (
        <button
          className="mt-2 font-bold text-primary"
          disabled={sync.isPending}
          onClick={() => run(true)}
        >
          Retry Steam sync
        </button>
      )}
    </div>
  );
}

export function BlockedUsers() {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["blocked-users"],
    queryFn: () => (typeof getBlockedUsers === "function" ? getBlockedUsers() : []),
  });
  const unblock = useMutation({
    mutationFn: (userId: string) =>
      typeof unblockUser === "function" ? unblockUser(userId) : Promise.resolve(),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["blocked-users"] });
      void client.invalidateQueries({ queryKey: ["user-search"] });
      void client.invalidateQueries({ queryKey: ["public-profile"] });
    },
  });
  return (
    <section className="rounded-2xl border border-border p-4">
      <h2 className="mb-3 text-lg font-bold">Blocked users</h2>
      {query.isPending && <p>Loading blocked users…</p>}
      {query.isError && (
        <p role="alert">
          Could not load blocked users.{" "}
          <button onClick={() => void query.refetch()}>Retry blocked users</button>
        </p>
      )}
      {query.data?.length === 0 && (
        <p className="text-sm text-muted-foreground">No blocked users.</p>
      )}
      {query.data?.map(({ user }) => (
        <div key={user.id} className="flex items-center justify-between gap-3 py-2">
          <span>{user.display_name}</span>
          <button
            disabled={unblock.isPending}
            className="rounded-lg border border-border px-3 py-2 text-sm"
            onClick={() => unblock.mutate(user.id)}
          >
            Unblock {user.display_name}
          </button>
        </div>
      ))}
      {unblock.isError && <p role="alert">{unblock.error.message}</p>}
      {unblock.isSuccess && <p role="status">User unblocked. Friendship has not been restored.</p>}
    </section>
  );
}
