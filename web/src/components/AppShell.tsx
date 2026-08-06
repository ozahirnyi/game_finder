import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  Gamepad2,
  Heart,
  Home,
  Library,
  Search,
  Tag,
  Trophy,
  User,
  Users,
} from "lucide-react";
import { ThemeSelector } from "./ThemeSelector";
import { NotificationsMenu } from "@/features/retention/NotificationsMenu";
import {
  currentUserQueryOptions,
  signOut,
  useAuthenticated,
} from "@/lib/auth-session";

const nav = [
  { to: "/", label: "Home", icon: Home },
  { to: "/search", label: "Search", icon: Search },
  { to: "/library", label: "Library", icon: Library },
  { to: "/wishlist", label: "Wishlist", icon: Heart },
  { to: "/deals", label: "Deals", icon: Tag },
  { to: "/friends", label: "Friends", icon: Users },
  { to: "/steam", label: "Steam", icon: Gamepad2 },
  { to: "/psn", label: "PSN", icon: Trophy },
  { to: "/profile", label: "Profile", icon: User },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const authenticated = useAuthenticated();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data: currentUser } = useQuery(currentUserQueryOptions());
  const visibleNav = authenticated
    ? nav
    : nav.filter((item) => item.to === "/" || item.to === "/search");
  const links = (items: readonly (typeof nav)[number][]) =>
    items.map((item) => {
      const active =
        item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
      const Icon = item.icon;
      return (
        <Link
          key={item.to}
          to={item.to}
          aria-current={active ? "page" : undefined}
          className={active ? "text-primary" : "text-muted-foreground"}
        >
          <Icon className="size-4" /> {item.label}
        </Link>
      );
    });
  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className="fixed left-0 top-0 hidden h-screen w-64 flex-col border-r border-border bg-surface p-6 lg:flex">
        <Link to="/" className="mb-8 text-xl font-bold">
          GameFinder
        </Link>
        <nav className="space-y-3">{links(visibleNav)}</nav>
        <div className="mt-auto space-y-4">
          {authenticated ? (
            <NotificationsMenu
              navigate={(target) => {
                void navigate({ to: target as "/games/$gameId" });
              }}
              openExternal={(target) => window.location.assign(target)}
            />
          ) : null}
          <ThemeSelector />
          {authenticated ? (
            <div>
              <p className="truncate text-sm font-semibold">
                {currentUser?.email ?? "Account"}
              </p>
              <button
                type="button"
                onClick={() => {
                  signOut(queryClient);
                  void navigate({ to: "/login" });
                }}
              >
                Sign out
              </button>
            </div>
          ) : (
            <Link to="/login">Sign in</Link>
          )}
        </div>
      </aside>
      <main className="lg:pl-64">
        <div className="mx-auto max-w-7xl px-5 py-8 pb-28 lg:px-10 lg:py-10">
          {children}
        </div>
      </main>
      <nav className="fixed bottom-0 left-0 right-0 flex justify-around border-t border-border bg-surface p-2 lg:hidden">
        {links(visibleNav.slice(0, 5))}
      </nav>
    </div>
  );
}
