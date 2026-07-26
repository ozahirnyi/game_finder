import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  Bell,
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
import { useAuthState } from "@/hooks/useAuthState";

const nav = [
  { to: "/", label: "Home", icon: Home, protected: false },
  { to: "/search", label: "Search", icon: Search, protected: false },
  { to: "/library", label: "Library", icon: Library, protected: true },
  { to: "/wishlist", label: "Wishlist", icon: Heart, protected: true },
  { to: "/deals", label: "Deals", icon: Tag, protected: false },
  { to: "/friends", label: "Friends", icon: Users, protected: true },
  { to: "/steam", label: "Steam", icon: Gamepad2, protected: true },
  { to: "/psn", label: "PSN", icon: Trophy, protected: true },
  { to: "/profile", label: "Profile", icon: User, protected: true },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const authenticated = useAuthState();
  const visibleNav = authenticated
    ? nav
    : nav.filter((item) => !item.protected);

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/30">
      <aside className="fixed left-0 top-0 z-40 hidden h-screen w-64 shrink-0 flex-col border-r border-border bg-surface p-6 lg:flex">
        <Link className="mb-10 flex items-center gap-3 px-2" to="/">
          <div className="grid size-8 place-items-center rounded-lg bg-primary">
            <div className="size-4 rounded-sm bg-background" />
          </div>
          <span className="text-xl font-bold uppercase tracking-tight">
            GameFinder
          </span>
        </Link>

        <nav className="space-y-1">
          {visibleNav.map((item) => (
            <NavigationLink
              active={
                item.to === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.to)
              }
              item={item}
              key={item.to}
            />
          ))}
        </nav>

        <div className="mt-auto space-y-4 pt-6">
          <ThemeSelector />
          {authenticated ? (
            <>
              <Link
                className="block rounded-xl border border-border bg-surface-2 p-4 text-xs text-muted-foreground hover:text-foreground"
                to="/steam"
              >
                Manage Steam sync
              </Link>
              <Link
                className="flex items-center gap-3 rounded-lg border border-transparent p-2 hover:border-border"
                to="/profile"
              >
                <span className="grid size-10 place-items-center rounded-full bg-secondary">
                  <User className="size-4" />
                </span>
                <span className="text-sm font-semibold">Your profile</span>
              </Link>
            </>
          ) : (
            <Link
              className="flex items-center justify-center rounded-lg bg-primary px-3 py-2 text-sm font-bold text-primary-foreground"
              to="/login"
            >
              Sign in
            </Link>
          )}
        </div>
      </aside>

      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/80 px-4 py-3 backdrop-blur lg:hidden">
        <Link className="flex items-center gap-2" to="/">
          <div className="grid size-7 place-items-center rounded-md bg-primary">
            <div className="size-3.5 rounded-sm bg-background" />
          </div>
          <span className="font-bold uppercase tracking-tight">GameFinder</span>
        </Link>
        <span
          aria-label="Notifications"
          className="grid size-9 place-items-center rounded-md border border-border"
          role="img"
        >
          <Bell className="size-4" />
        </span>
      </header>

      <main className="lg:pl-64">
        <div className="mx-auto max-w-7xl px-5 py-8 pb-28 lg:px-10 lg:py-10">
          {children}
        </div>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-border bg-surface/90 px-2 py-2 backdrop-blur lg:hidden">
        {visibleNav.slice(0, 5).map((item) => (
          <NavigationLink
            active={
              item.to === "/"
                ? pathname === "/"
                : pathname.startsWith(item.to)
            }
            item={item}
            key={item.to}
            mobile
          />
        ))}
      </nav>
    </div>
  );
}

function NavigationLink({
  item,
  active,
  mobile = false,
}: {
  item: (typeof nav)[number];
  active: boolean;
  mobile?: boolean;
}) {
  const Icon = item.icon;
  return (
    <Link
      aria-current={active ? "page" : undefined}
      className={
        mobile
          ? `flex min-w-0 flex-1 flex-col items-center gap-1 rounded-md px-2 py-1.5 ${
              active ? "text-primary" : "text-muted-foreground"
            }`
          : `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              active
                ? "bg-white/5 text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`
      }
      to={item.to}
    >
      <Icon className="size-4" />
      <span
        className={
          mobile
            ? "text-[10px] font-semibold uppercase tracking-tight"
            : undefined
        }
      >
        {item.label}
      </span>
    </Link>
  );
}
