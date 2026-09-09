import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { blockUser, removeFriend } from "@/lib/api";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";

export function FriendActions({
  userId,
  name,
  isFriend,
  compact = false,
}: {
  userId: string;
  name: string;
  isFriend: boolean;
  compact?: boolean;
}) {
  const [action, setAction] = useState<"remove" | "block" | null>(null);
  const [notice, setNotice] = useState("");
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: (kind: "remove" | "block") =>
      kind === "remove" ? removeFriend(userId) : blockUser(userId),
    onSuccess: (_, kind) => {
      setAction(null);
      setNotice(kind === "remove" ? "Friend removed" : "User blocked");
      // Clear private cached data before refetching the new relationship.
      void client.resetQueries({
        predicate: (query) =>
          [
            "friend-profile",
            "public-profile",
            "shared-games",
            "friend-social-summary",
            "conversation",
            "conversation-messages",
            "conversation-has-older",
          ].includes(String(query.queryKey[0])),
      });
      void client.invalidateQueries({
        predicate: (query) =>
          [
            "friends",
            "friend-requests",
            "blocked-users",
            "conversations",
            "game-invites",
            "notifications",
            "onboarding-summary",
            "user-search",
          ].includes(String(query.queryKey[0])),
      });
    },
  });
  const button = "rounded-lg border border-border px-3 py-2 text-xs font-bold disabled:opacity-50";
  const controls = (
    <div className="flex flex-wrap gap-2">
      {isFriend && (
        <button
          className={button}
          onClick={() => {
            mutation.reset();
            setAction("remove");
          }}
        >
          Remove friend
        </button>
      )}
      <button
        className={`${button} text-destructive`}
        onClick={() => {
          mutation.reset();
          setAction("block");
        }}
      >
        Block user
      </button>
    </div>
  );
  return (
    <div className="mt-3">
      {compact ? (
        <details className="text-sm">
          <summary className="cursor-pointer font-bold text-muted-foreground">More actions</summary>
          <div className="mt-2">{controls}</div>
        </details>
      ) : (
        controls
      )}
      {notice && (
        <p role="status" className="mt-2 text-sm">
          {notice}
        </p>
      )}
      <AlertDialog
        open={action !== null}
        onOpenChange={(open) => {
          if (!open && !mutation.isPending) setAction(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {action === "remove" ? `Remove ${name} from friends?` : `Block ${name}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {action === "remove"
                ? "Steam will not add this friend back automatically. Your conversation remains read-only."
                : "This removes the friendship and prevents messages, invitations and profile access between your accounts. You can unblock them from Friends."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {mutation.isError && (
            <p role="alert" className="text-sm text-destructive">
              {mutation.error.message}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={mutation.isPending}>Cancel</AlertDialogCancel>
            <button
              className={`${button} bg-destructive text-white`}
              disabled={mutation.isPending}
              onClick={() => {
                if (action) mutation.mutate(action);
              }}
            >
              {action === "remove" ? "Confirm removal" : "Confirm block"}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
