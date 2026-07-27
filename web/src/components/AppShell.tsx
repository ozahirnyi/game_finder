import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Bell, Gamepad2, Heart, Home, Library, Search, Tag, Trophy, User, Users } from "lucide-react";
import { useAuthState } from "@/hooks/useAuthState";
import { ThemeSelector } from "./ThemeSelector";

const publicNav = [
  { to: "/", label: "Home", icon: Home },
  { to: "/search", label: "Search", icon: Search },
  { to: "/deals", label: "Deals", icon: Tag },
] as const;

const protectedNav = [
  { to: "/library", label: "Library", icon: Library },
  { to: "/wishlist", label: "Wishlist", icon: Heart },
  { to: "/friends", label: "Friends", icon: Users },
  { to: "/steam", label: "Steam", icon: Gamepad2 },
  { to: "/psn", label: "PSN", icon: Trophy },
  { to: "/profile", label: "Profile", icon: User },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const authenticated = useAuthState();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const nav = authenticated ? [...publicNav, ...protectedNav] : publicNav;

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/30">
      <aside className="fixed left-0 top-0 z-40 hidden h-screen w-64 shrink-0 flex-col border-r border-border bg-surface p-6 lg:flex">
        <Link to="/" className="mb-10 flex items-center gap-3 px-2"><span className="grid size-8 place-items-center rounded-lg bg-primary"><span className="size-4 rounded-sm bg-background" /></span><span className="text-xl font-bold uppercase tracking-tight">GameFinder</span></Link>
        <Navigation nav={nav} pathname={pathname} />
        <div className="mt-auto space-y-4 pt-6">
          <ThemeSelector />
          {authenticated ? <Link to="/profile" className="block rounded-lg border border-border p-3 text-sm font-semibold">Manage profile</Link> : <Link to="/" aria-label="Sign in" className="block rounded-lg border border-border p-3 text-sm font-semibold">Sign in to personalize</Link>}
        </div>
      </aside>
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/80 px-4 py-3 backdrop-blur lg:hidden"><Link to="/" className="font-bold uppercase tracking-tight">GameFinder</Link><Bell className="size-4" aria-hidden="true" /></header>
      <main className="lg:pl-64"><div className="mx-auto max-w-7xl px-5 py-8 pb-28 lg:px-10 lg:py-10">{children}</div></main>
      <nav className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-border bg-surface/90 px-2 py-2 backdrop-blur lg:hidden"><Navigation nav={nav.slice(0, 5)} pathname={pathname} compact /></nav>
    </div>
  );
}

function Navigation({ nav, pathname, compact = false }: { nav: readonly { to: string; label: string; icon: typeof Home }[]; pathname: string; compact?: boolean }) {
  return <nav className={compact ? "flex w-full justify-around" : "space-y-1"}>{nav.map((item) => { const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to); const Icon = item.icon; return <Link key={item.to} to={item.to} aria-current={active ? "page" : undefined} className={compact ? "flex flex-col items-center gap-1 text-[10px]" : `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium ${active ? "bg-white/5 text-foreground" : "text-muted-foreground hover:text-foreground"}`}><Icon className="size-4" />{item.label}</Link>; })}</nav>;
}
