"use client";

import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  Home,
  Search,
  Library,
  Heart,
  Tag,
  Users,
  Gamepad2,
  Trophy,
  User,
  Bell,
} from "lucide-react";
import { Avatar } from "./GameCover";
import { ThemeSelector } from "./ThemeSelector";
import { currentUser } from "@/lib/mockData";

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

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/30">
      {/* Desktop sidebar */}
      <aside className="fixed left-0 top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-border bg-surface p-6 lg:flex z-40">
        <Link to="/" className="mb-10 flex items-center gap-3 px-2">
          <div className="grid size-8 place-items-center rounded-lg bg-primary">
            <div className="size-4 rounded-sm bg-background" />
          </div>
          <span className="text-xl font-bold uppercase tracking-tight">
            GameFinder
          </span>
        </Link>

        <nav className="space-y-1">
          {nav.map((item) => {
            const active =
              item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "bg-white/5 text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto space-y-4 pt-6">
          <ThemeSelector />
          <div className="relative overflow-hidden rounded-xl border border-border bg-surface-2 p-4">
            <div className="absolute -right-6 -bottom-6 size-24 rounded-full bg-primary/10 blur-3xl" />
            <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-primary">
              Steam · Synced
            </p>
            <p className="text-xs text-muted-foreground">
              {currentUser.stats.library} games · updated 4m ago
            </p>
          </div>

          <Link
            to="/profile"
            className="flex items-center gap-3 rounded-lg border border-transparent p-2 hover:border-border"
          >
            <Avatar
              from={currentUser.avatarFrom}
              to={currentUser.avatarTo}
              name={currentUser.name}
              className="size-10 shrink-0 rounded-full"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">
                {currentUser.name}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                @{currentUser.handle}
              </p>
            </div>
          </Link>
        </div>
      </aside>

      {/* Top bar (mobile) */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/80 px-4 py-3 backdrop-blur lg:hidden">
        <Link to="/" className="flex items-center gap-2">
          <div className="grid size-7 place-items-center rounded-md bg-primary">
            <div className="size-3.5 rounded-sm bg-background" />
          </div>
          <span className="font-bold uppercase tracking-tight">GameFinder</span>
        </Link>
        <button className="grid size-9 place-items-center rounded-md border border-border">
          <Bell className="size-4" />
        </button>
      </header>

      <main className="lg:pl-64">
        <div className="mx-auto max-w-7xl px-5 py-8 pb-28 lg:px-10 lg:py-10">
          {children}
        </div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-border bg-surface/90 px-2 py-2 backdrop-blur lg:hidden">
        {nav.slice(0, 5).map((item) => {
          const active =
            item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex min-w-0 flex-1 flex-col items-center gap-1 rounded-md px-2 py-1.5 ${
                active ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <Icon className="size-4" />
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
