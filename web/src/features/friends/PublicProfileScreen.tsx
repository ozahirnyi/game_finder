import { useEffect, useRef, useState } from "react";
import type {
  SocialMe,
  SocialProfile,
  SocialRelationship,
  SocialRequest,
} from "@/lib/api";
import {
  acceptFriendRequest,
  cancelFriendRequest,
  createFriendRequest,
  declineFriendRequest,
  getSocialMe,
  getSocialProfile,
} from "@/lib/api";
import { useAuthState } from "@/hooks/useAuthState";

const cardClass =
  "mx-auto max-w-xl rounded-3xl border border-border bg-surface p-7";
const primaryButtonClass =
  "rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50";
const secondaryButtonClass =
  "rounded-lg border border-border bg-secondary px-4 py-2 text-sm font-bold disabled:opacity-50";

function errorMessage(reason: unknown, fallback: string) {
  return reason instanceof Error ? reason.message : fallback;
}

function publicProfilePath(publicId: string) {
  return `/users/${encodeURIComponent(publicId)}`;
}

function loginHref(returnTo: string) {
  return `/login?returnTo=${encodeURIComponent(returnTo)}`;
}

export function PublicProfileScreen({ publicId }: { publicId: string }) {
  const authenticated = useAuthState();
  const activePublicId = useRef(publicId);
  activePublicId.current = publicId;
  const [profile, setProfile] = useState<SocialProfile | null>(null);
  const [social, setSocial] = useState<SocialMe | null>(null);
  const [outgoingRequest, setOutgoingRequest] = useState<SocialRequest | null>(
    null,
  );
  const [loading, setLoading] = useState(authenticated);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!authenticated) return;
    let active = true;
    setProfile(null);
    setSocial(null);
    setOutgoingRequest(null);
    setLoading(true);
    setBusy(false);
    setError("");

    getSocialProfile(publicId)
      .then(async (profileData) => {
        if (!active) return;
        setProfile(profileData);
        if (
          profileData.relationship === "incoming_pending" ||
          profileData.relationship === "outgoing_pending" ||
          profileData.relationship === "friends"
        ) {
          const socialData = await getSocialMe();
          if (active) {
            setSocial(socialData);
            setOutgoingRequest(
              socialData.outgoing_requests.find(
                (request) => request.public_id === publicId,
              ) ?? null,
            );
          }
        }
      })
      .catch((reason) => {
        if (active)
          setError(errorMessage(reason, "Could not load this profile."));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [authenticated, publicId]);

  function matchingRequest(
    requests: SocialRequest[] | undefined,
  ): SocialRequest | undefined {
    return requests?.find((request) => request.public_id === publicId);
  }

  async function addFriend() {
    const requestedPublicId = publicId;
    setBusy(true);
    setError("");
    try {
      const request = await createFriendRequest(requestedPublicId);
      if (activePublicId.current !== requestedPublicId) return;
      setOutgoingRequest(request);
      setSocial((current) =>
        current
          ? {
              ...current,
              outgoing_requests: [...current.outgoing_requests, request],
            }
          : current,
      );
      setProfile((current) =>
        current ? { ...current, relationship: "outgoing_pending" } : current,
      );
    } catch (reason) {
      if (activePublicId.current === requestedPublicId) {
        setError(errorMessage(reason, "Could not send this friend request."));
      }
    } finally {
      if (activePublicId.current === requestedPublicId) setBusy(false);
    }
  }

  async function cancelRequest() {
    const request =
      outgoingRequest ?? matchingRequest(social?.outgoing_requests);
    if (!request) {
      setError("This friend request is no longer pending.");
      return;
    }
    const requestedPublicId = publicId;
    setBusy(true);
    setError("");
    try {
      await cancelFriendRequest(request.id);
      if (activePublicId.current !== requestedPublicId) return;
      setProfile((current) =>
        current ? { ...current, relationship: "none" } : current,
      );
      setOutgoingRequest(null);
      setSocial((current) =>
        current
          ? {
              ...current,
              outgoing_requests: current.outgoing_requests.filter(
                (item) => item.id !== request.id,
              ),
            }
          : current,
      );
    } catch (reason) {
      if (activePublicId.current === requestedPublicId) {
        setError(errorMessage(reason, "Could not cancel this friend request."));
      }
    } finally {
      if (activePublicId.current === requestedPublicId) setBusy(false);
    }
  }

  async function respond(response: "accept" | "decline") {
    const request = matchingRequest(social?.incoming_requests);
    if (!request) {
      setError("This friend request is no longer pending.");
      return;
    }
    const requestedPublicId = publicId;
    setBusy(true);
    setError("");
    try {
      if (response === "accept") {
        await acceptFriendRequest(request.id);
        if (activePublicId.current !== requestedPublicId) return;
        setProfile((current) =>
          current ? { ...current, relationship: "friends" } : current,
        );
        const refreshedSocial = await getSocialMe();
        if (activePublicId.current !== requestedPublicId) return;
        setSocial(refreshedSocial);
      } else {
        await declineFriendRequest(request.id);
        if (activePublicId.current !== requestedPublicId) return;
        setProfile((current) =>
          current ? { ...current, relationship: "none" } : current,
        );
      }
      setSocial((current) =>
        current
          ? {
              ...current,
              incoming_requests: current.incoming_requests.filter(
                (item) => item.id !== request.id,
              ),
            }
          : current,
      );
    } catch (reason) {
      if (activePublicId.current === requestedPublicId) {
        setError(errorMessage(reason, `Could not ${response} this request.`));
      }
    } finally {
      if (activePublicId.current === requestedPublicId) setBusy(false);
    }
  }

  function relationshipAction(relationship: SocialRelationship) {
    if (relationship === "none") {
      return (
        <button
          className={primaryButtonClass}
          disabled={busy}
          onClick={() => void addFriend()}
          type="button"
        >
          {busy ? "Sending…" : "Add friend"}
        </button>
      );
    }
    if (relationship === "outgoing_pending") {
      const request =
        outgoingRequest ?? matchingRequest(social?.outgoing_requests);
      return request ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="font-bold text-primary">Request sent</p>
          <button
            className={secondaryButtonClass}
            disabled={busy}
            onClick={() => void cancelRequest()}
            type="button"
          >
            Cancel request
          </button>
        </div>
      ) : (
        <p className="font-bold text-primary">Request sent</p>
      );
    }
    if (relationship === "incoming_pending") {
      return (
        <div className="flex flex-wrap gap-2">
          <button
            className={primaryButtonClass}
            disabled={busy}
            onClick={() => void respond("accept")}
            type="button"
          >
            Accept request
          </button>
          <button
            className={secondaryButtonClass}
            disabled={busy}
            onClick={() => void respond("decline")}
            type="button"
          >
            Decline
          </button>
        </div>
      );
    }
    if (relationship === "friends") {
      const friend = social?.friends.find(
        (item) => item.public_id === publicId,
      );
      return (
        <div className="flex flex-wrap items-center gap-3">
          <p className="font-bold text-primary">Already friends</p>
          {friend ? (
            <a
              className={primaryButtonClass}
              href={`/friends/${encodeURIComponent(friend.id)}/messages`}
            >
              Message {profile?.nickname ?? "friend"}
            </a>
          ) : null}
        </div>
      );
    }
    return (
      <p className="text-sm text-muted-foreground">This is your profile.</p>
    );
  }

  if (!authenticated) {
    return (
      <article className={cardClass}>
        <h1 className="text-2xl font-bold">Sign in to view this profile</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sign in first, then choose whether to send a friend request.
        </p>
        <a
          className={`${primaryButtonClass} mt-5 inline-flex`}
          href={loginHref(publicProfilePath(publicId))}
        >
          Sign in
        </a>
      </article>
    );
  }

  if (loading) {
    return (
      <p role="status" className="text-center text-sm text-muted-foreground">
        Loading profile…
      </p>
    );
  }

  if (error && !profile) {
    return (
      <article className={cardClass}>
        <h1 className="text-2xl font-bold">Profile unavailable</h1>
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      </article>
    );
  }

  if (!profile) return null;

  return (
    <article className={cardClass}>
      <p className="font-mono text-xs uppercase tracking-widest text-primary">
        PlayFinder profile
      </p>
      <div className="mt-5 flex items-center gap-4">
        {profile.avatar ? (
          <img
            alt={`${profile.nickname}'s avatar`}
            className="size-16 rounded-full object-cover"
            src={profile.avatar}
          />
        ) : (
          <div
            aria-hidden="true"
            className="grid size-16 place-items-center rounded-full bg-secondary text-xl font-bold"
          >
            {profile.nickname.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <h1 className="truncate text-3xl font-extrabold tracking-tight">
            {profile.nickname}
          </h1>
          <p className="truncate font-mono text-xs text-muted-foreground">
            @{profile.public_id}
          </p>
        </div>
      </div>
      <p className="mt-5 text-sm text-muted-foreground">
        This profile shares only a public nickname and avatar.
      </p>
      <div className="mt-6">{relationshipAction(profile.relationship)}</div>
      {error ? (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </article>
  );
}
