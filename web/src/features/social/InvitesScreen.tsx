import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listInvites, respondToInvite, type GameInvite } from "@/lib/api";

export function InvitesScreen() {
  const client = useQueryClient();
  const invites = useQuery({
    queryKey: ["social", "invites"],
    queryFn: listInvites,
  });
  const transition = useMutation({
    mutationFn: ({
      id,
      action,
    }: {
      id: string;
      action: "accept" | "decline" | "cancel";
    }) => respondToInvite(id, action),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: ["social", "invites"] }),
  });
  if (invites.isLoading) return <p>Loading invites…</p>;
  if (invites.isError)
    return <button onClick={() => invites.refetch()}>Retry invites</button>;
  const controls = (invite: GameInvite) =>
    invite.status === "pending" ? (
      invite.direction === "incoming" ? (
        <>
          <button
            disabled={transition.isPending}
            onClick={() =>
              transition.mutate({ id: invite.id, action: "accept" })
            }
          >
            Accept invite
          </button>
          <button
            disabled={transition.isPending}
            onClick={() =>
              transition.mutate({ id: invite.id, action: "decline" })
            }
          >
            Decline invite
          </button>
        </>
      ) : (
        <button
          disabled={transition.isPending}
          onClick={() => transition.mutate({ id: invite.id, action: "cancel" })}
        >
          Cancel invite
        </button>
      )
    ) : null;
  return (
    <section>
      <h1>Game invites</h1>
      {invites.data.length ? (
        <ul>
          {invites.data.map((invite) => (
            <li key={invite.id}>
              <p>
                {invite.game_title} — {invite.status}
              </p>
              {controls(invite)}
            </li>
          ))}
        </ul>
      ) : (
        <p>No game invites.</p>
      )}
      {transition.isError ? <p role="alert">Could not update invite.</p> : null}
    </section>
  );
}
