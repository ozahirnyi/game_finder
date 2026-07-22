import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
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
import { ThemeSelector } from "./ThemeSelector";
import {
  isAuthenticated,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  subscribeToAuthChanges,
  type Notification,
} from "@/lib/api";

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

function notificationText(notification: Notification) {
  if (notification.type === "friend_request")
    return `${notification.payload.from ?? "A player"} sent you a friend request.`;
  if (notification.type === "friend_request_accepted")
    return `${notification.payload.by ?? "A player"} accepted your friend request.`;
  if (notification.type === "message")
    return `${notification.payload.from ?? "A friend"} sent you a message.`;
  if (notification.type === "game_invite")
    return `${notification.payload.from ?? "A friend"} invited you to play ${notification.payload.game_name ?? "a game"}.`;
  return "You have a new GameFinder notification.";
}

function NotificationMenu({
  authenticated,
  mobile = false,
}: {
  authenticated: boolean;
  mobile?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const unread = items.filter((item) => !item.read_at).length;
  const refresh = () =>
    authenticated &&
    listNotifications()
      .then(setItems)
      .catch(() => setItems([]));
  useEffect(() => {
    refresh();
  }, [authenticated]);
  const read = async (item: Notification) => {
    if (!item.read_at) await markNotificationRead(item.id);
    refresh();
  };
  const readAll = async () => {
    await markAllNotificationsRead();
    refresh();
  };
  return (
    <div className="relative">
      <button
        aria-label={mobile ? "Mobile notifications" : "Notifications"}
        onClick={() => setOpen((value) => !value)}
        className="relative grid size-9 place-items-center rounded-md border border-border"
      >
        <Bell className="size-4" />
        {authenticated && unread > 0 ? (
          <span className="absolute -right-1 -top-1 grid size-4 place-items-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>
      {open ? (
        <div
          className={`absolute z-50 w-80 rounded-xl border border-border bg-surface p-3 shadow-xl ${mobile ? "right-0 mt-2" : "bottom-full left-0 mb-2"}`}
        >
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-bold">Notifications</p>
            {unread ? (
              <button onClick={readAll} className="text-xs text-primary">
                Mark all read
              </button>
            ) : null}
          </div>
          {!authenticated ? (
            <p className="p-2 text-sm text-muted-foreground">
              Sign in to see notifications.
            </p>
          ) : items.length ? (
            <div className="max-h-80 space-y-1 overflow-y-auto">
              {items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => read(item)}
                  className={`w-full rounded-lg p-2 text-left text-sm ${item.read_at ? "text-muted-foreground" : "bg-primary/10"}`}
                >
                  {notificationText(item)}
                </button>
              ))}
            </div>
          ) : (
            <p className="p-2 text-sm text-muted-foreground">
              You are all caught up.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [authenticated, setAuthenticated] = useState(isAuthenticated);

  useEffect(
    () => subscribeToAuthChanges(() => setAuthenticated(isAuthenticated())),
    [],
  );

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
          <NotificationMenu authenticated={authenticated} />
          <ThemeSelector />
          {!authenticated ? (
            <div className="relative overflow-hidden rounded-xl border border-border bg-surface-2 p-4">
              <div className="absolute -right-6 -bottom-6 size-24 rounded-full bg-primary/10 blur-3xl" />
              <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-primary">
                Your account
              </p>
              <div className="relative flex gap-2 text-sm">
                <Link
                  to="/login"
                  className="font-semibold text-primary hover:underline"
                >
                  Sign in
                </Link>
                <Link
                  to="/register"
                  className="font-semibold text-primary hover:underline"
                >
                  Create account
                </Link>
              </div>
            </div>
          ) : (
            <Link
              to="/profile"
              className="flex items-center gap-3 rounded-lg border border-transparent p-2 hover:border-border"
            >
              <User className="size-10 shrink-0 rounded-full border border-border p-2 text-muted-foreground" />
              <span className="truncate text-sm font-semibold">Signed in</span>
            </Link>
          )}
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
        <NotificationMenu authenticated={authenticated} mobile />
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
