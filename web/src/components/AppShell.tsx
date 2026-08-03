import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Home, Search, Library, Heart, Tag, Users, Palette } from "lucide-react";
import { ThemeSelector } from "./ThemeSelector";
import { Avatar } from "./GameCover";
import { getAuthSnapshot, getDeals, getProfile, subscribeToAuthChanges } from "@/lib/api";
import { friendsQueryOptions, incomingFriendRequestsQueryOptions, libraryOverviewQueryOptions, steamSocialInfiniteQueryOptions } from "@/lib/navigationQueries";

const nav = [
  { to: "/", label: "Home", icon: Home },
  { to: "/search", label: "Search", icon: Search },
  { to: "/library", label: "Library", icon: Library },
  { to: "/wishlist", label: "Wishlist", icon: Heart },
  { to: "/deals", label: "Deals", icon: Tag },
  { to: "/friends", label: "Friends", icon: Users },
] as const;

function scheduleIdle(callback: () => void) {
  if ("requestIdleCallback" in window) {
    const idleCallback = window.requestIdleCallback(callback);
    return () => window.cancelIdleCallback(idleCallback);
  }
  const timeout = window.setTimeout(callback, 0);
  return () => window.clearTimeout(timeout);
}

function relativeDealsAge(cachedAt?: string | null) {
  const timestamp = cachedAt ? Date.parse(cachedAt) : Number.NaN;
  const ageMinutes = Math.floor((Date.now() - timestamp) / 60_000);
  if (!Number.isFinite(ageMinutes) || ageMinutes < 0) return null;
  if (ageMinutes < 1) return "refreshed just now";
  if (ageMinutes < 60) return `refreshed ${ageMinutes}m ago`;
  return `refreshed ${Math.floor(ageMinutes / 60)}h ago`;
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [themeOpen, setThemeOpen] = useState(false);
  const [sidebarDealsReady, setSidebarDealsReady] = useState(false);
  const signedIn = useSyncExternalStore(subscribeToAuthChanges, getAuthSnapshot, () => false);
  const queryClient = useQueryClient();
  const prefetchDestination = (to: (typeof nav)[number]["to"]) => {
    if (to === "/library") {
      void queryClient.prefetchQuery(libraryOverviewQueryOptions());
    }
    if (to === "/friends") {
      void queryClient.prefetchQuery(friendsQueryOptions());
      void queryClient.prefetchQuery(incomingFriendRequestsQueryOptions());
      void queryClient.prefetchInfiniteQuery(steamSocialInfiniteQueryOptions());
    }
  };

  useEffect(() => {
    if (!signedIn) return;

    const prefetch = () => {
      prefetchDestination("/library");
      prefetchDestination("/friends");
    };
    return scheduleIdle(prefetch);
  }, [queryClient, signedIn]);

  useEffect(() => scheduleIdle(() => setSidebarDealsReady(true)), []);
  const dealsQuery = useQuery({
    queryKey: ["deals", "US", "sidebar"],
    queryFn: () => getDeals("US"),
    enabled: sidebarDealsReady,
  });
  const deals = dealsQuery.data?.results ?? [];
  const dealsAge = relativeDealsAge(dealsQuery.data?.cached_at);
  const profileQuery = useQuery({
    queryKey: ["profile", "shell"],
    queryFn: getProfile,
    enabled: signedIn,
  });
  const profile = profileQuery.data;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Desktop sidebar */}
      <aside className="fixed left-0 top-0 z-40 hidden h-screen w-64 shrink-0 flex-col border-r border-border bg-surface p-6 lg:flex">
        <Link to="/" preload="intent" className="mb-10 flex items-center gap-3 px-2">
          <div className="grid size-8 place-items-center rounded-lg bg-primary shadow-[0_8px_24px_-10px_var(--primary)]">
            <div className="size-3.5 rounded-sm bg-primary-foreground" />
          </div>
          <span className="font-display text-lg font-bold uppercase tracking-tight">
            Playfinder
          </span>
        </Link>

        <nav className="space-y-0.5">
          {nav.map((item) => {
            const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                preload="intent"
                onFocus={() => prefetchDestination(item.to)}
                onPointerEnter={() => prefetchDestination(item.to)}
                className={`group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 ease-[var(--ease-studio)] ${
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:translate-x-0.5 hover:bg-surface-2 hover:text-foreground"
                }`}
              >
                {active && (
                  <span className="animate-pop absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r bg-primary" />
                )}
                <Icon className="size-4 transition-transform duration-200 ease-[var(--ease-studio)] group-hover:scale-110" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto space-y-4 pt-6">
          <ThemeSelector />

          <div className="ember-glow grain relative overflow-hidden rounded-xl border border-border bg-surface-2 p-4">
            {sidebarDealsReady && !dealsQuery.isPending ? (
              <>
                <p className="label-mono relative mb-1.5 text-primary">Live deals</p>
                <p className="relative text-xs text-muted-foreground">
                  {deals.length} price drops tracked{dealsAge ? ` · ${dealsAge}` : ""}
                </p>
              </>
            ) : <p className="label-mono relative text-primary">Live deals · loading</p>}
          </div>

          {signedIn && profile ? (
            <Link
              to="/account"
              preload="intent"
              className="flex items-center gap-3 rounded-xl border border-border p-3 transition hover:border-primary/50"
            >
              <Avatar
                from="#e85d3a"
                to="#7c2d12"
                name={profile.display_name}
                className="size-9 shrink-0 rounded-full"
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{profile.display_name}</p>
                <p className="truncate text-xs text-muted-foreground">Manage profile</p>
              </div>
            </Link>
          ) : (
            <div className="rounded-xl border border-border p-4">
              <p className="label-mono mb-2 text-muted-foreground">Your account</p>
              <div className="flex items-center gap-2">
                <Link
                  to="/sign-in"
                  preload="intent"
                  className="flex-1 rounded-lg border border-border px-3 py-2 text-center text-xs font-bold transition hover:border-primary/50"
                >
                  Sign in
                </Link>
                <Link
                  to="/sign-up"
                  preload="intent"
                  className="flex-1 rounded-lg bg-primary px-3 py-2 text-center text-xs font-bold text-primary-foreground transition hover:opacity-90"
                >
                  Create
                </Link>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Top bar (mobile) */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 px-4 py-3 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between">
          <Link to="/" preload="intent" className="flex items-center gap-2">
            <div className="grid size-7 place-items-center rounded-md bg-primary">
              <div className="size-3.5 rounded-sm bg-primary-foreground" />
            </div>
            <span className="font-bold uppercase tracking-tight">Playfinder</span>
          </Link>
          <div className="flex items-center gap-2">
            <button
              aria-label="Theme settings"
              aria-expanded={themeOpen}
              onClick={() => setThemeOpen((v) => !v)}
              className={`grid size-9 place-items-center rounded-md border transition ${
                themeOpen ? "border-primary/60 text-primary" : "border-border text-muted-foreground"
              }`}
            >
              <Palette className="size-4" />
            </button>
            {signedIn && profile ? (
              <Link to="/account" preload="intent" aria-label="Your profile">
                <Avatar
                  from="#e85d3a"
                  to="#7c2d12"
                  name={profile.display_name}
                  className="size-9 rounded-full ring-1 ring-border"
                />
              </Link>
            ) : (
              <Link
                to="/sign-in"
                preload="intent"
                className="rounded-md bg-primary px-3 py-2 text-xs font-bold text-primary-foreground"
              >
                Sign in
              </Link>
            )}
          </div>
        </div>
        {themeOpen && (
          <div className="animate-reveal mt-3">
            <ThemeSelector />
          </div>
        )}
      </header>

      <main className="lg:pl-64">
        <div
          key={pathname}
          className="animate-reveal mx-auto max-w-7xl px-5 py-8 pb-28 lg:px-10 lg:py-10"
        >
          {children}
        </div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-border bg-surface/90 px-2 py-2 backdrop-blur lg:hidden">
        {nav.map((item) => {
          const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              preload="intent"
              onFocus={() => prefetchDestination(item.to)}
              onPointerEnter={() => prefetchDestination(item.to)}
              className={`relative flex min-w-0 flex-1 flex-col items-center gap-1 rounded-md px-1 py-1.5 transition-colors duration-200 active:scale-95 ${
                active ? "text-primary" : "text-muted-foreground"
              }`}
            >
              {active && (
                <span className="animate-pop absolute -top-0.5 h-0.5 w-6 rounded-full bg-primary" />
              )}
              <Icon
                className={`size-4 transition-transform duration-300 ease-[var(--ease-studio)] ${
                  active ? "scale-110" : ""
                }`}
              />
              <span className="text-[10px] font-semibold uppercase tracking-tight">
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
