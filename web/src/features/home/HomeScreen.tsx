"use client";

import { useEffect, useState } from "react";
import { useAuthState } from "@/hooks/useAuthState";
import { getSteamAccount, type SteamAccount } from "@/lib/api";
import { GuestHome } from "./GuestHome";
import { SteamConnectPrompt } from "./SteamConnectPrompt";
import { PersonalDashboard } from "./PersonalDashboard";

type AccountState =
  | { status: "loading" }
  | { status: "ready"; account: SteamAccount }
  | { status: "error" };

export function HomeScreen() {
  const authenticated = useAuthState();
  const [retry, setRetry] = useState(0);
  const [state, setState] = useState<AccountState>({ status: "loading" });

  useEffect(() => {
    if (!authenticated) return;
    let active = true;
    setState({ status: "loading" });
    void getSteamAccount()
      .then((account) => active && setState({ status: "ready", account }))
      .catch(() => active && setState({ status: "error" }));
    return () => {
      active = false;
    };
  }, [authenticated, retry]);

  if (!authenticated) return <GuestHome />;
  if (state.status === "loading")
    return (
      <div
        className="skeleton-shimmer"
        aria-label="Loading your personalized homepage"
      />
    );
  if (state.status === "error") {
    return (
      <div className="stack">
        <SteamConnectPrompt />
        <button type="button" onClick={() => setRetry((value) => value + 1)}>
          Retry Steam connection
        </button>
      </div>
    );
  }
  if (!state.account.linked) return <SteamConnectPrompt />;

  return <PersonalDashboard steamAccount={state.account} />;
}
