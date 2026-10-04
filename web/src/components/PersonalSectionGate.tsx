import { Link } from "@tanstack/react-router";
import {
  ArrowUpRight,
  FileUp,
  Heart,
  MessageCircle,
  Search,
  Tag,
  UserRound,
  UsersRound,
} from "lucide-react";
import { useSyncExternalStore, type ReactNode } from "react";
import { AppShell } from "@/components/AppShell";
import { getAuthSnapshot, subscribeToAuthChanges } from "@/lib/api";

function BooksIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 128 128"
      fill="none"
      stroke="currentColor"
      strokeWidth="5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="12" y="31" width="27" height="72" rx="5" />
      <rect x="48" y="22" width="27" height="81" rx="5" />
      <path d="M16 89h19M52 89h19" />
      <g transform="rotate(-16 99 69)">
        <rect x="86" y="34" width="26" height="70" rx="5" />
        <path d="M90 90h18" />
      </g>
    </svg>
  );
}

const sections = {
  account: {
    title: "Your profile",
    headline: "Make Playfinder yours.",
    description: "Sign in to see your profile, connected stores, and account settings.",
    icon: UserRound,
  },
  friends: {
    title: "Friends",
    headline: "Find people to play with.",
    description: "Sign in to see your friends, requests, and game invitations.",
    icon: UsersRound,
  },
  library: {
    title: "Library",
    headline: "Your games, all in one place.",
    description: "Sign in to bring your Steam and PlayStation games together.",
    icon: BooksIcon,
  },
  wishlist: {
    title: "Wishlist",
    headline: "Keep an eye on the games you want.",
    description:
      "Save games, follow prices in your region, and know when a deal is worth coming back for.",
    icon: Heart,
  },
  chats: {
    title: "Chats",
    headline: "Keep the conversation going.",
    description: "Sign in to message friends and see your game invitations.",
    icon: MessageCircle,
  },
  players: {
    title: "Players",
    headline: "Find your next teammate.",
    description: "Sign in to explore players and send friend requests.",
    icon: UsersRound,
  },
  psnImport: {
    title: "PlayStation import",
    headline: "Bring your PlayStation games in.",
    description: "Sign in to add your PlayStation games to your library.",
    icon: FileUp,
  },
  psnRepair: {
    title: "PlayStation library",
    headline: "Keep your library in shape.",
    description: "Sign in to review and repair your imported PlayStation games.",
    icon: BooksIcon,
  },
} as const;

export function PersonalSectionGate({
  section,
  children,
}: {
  section: keyof typeof sections;
  children: ReactNode;
}) {
  const signedIn = useSyncExternalStore(subscribeToAuthChanges, getAuthSnapshot, () => false);
  if (signedIn) return children;

  const { title, headline, description, icon: Icon } = sections[section];
  return (
    <AppShell>
      <div
        className={`mx-auto w-full max-w-5xl ${section === "chats" ? "animate-reveal px-5 pt-10 pb-28 sm:pt-[52px] lg:px-10 lg:pt-[60px]" : "py-2 sm:py-5"}`}
      >
        <h1 className="mb-5 text-sm font-bold text-muted-foreground">{title}</h1>

        <section className="relative isolate overflow-hidden rounded-[1.25rem] border border-border bg-gradient-to-br from-surface via-surface to-surface-2 px-6 py-9 sm:px-9 sm:py-10 lg:min-h-[290px] lg:px-10">
          <div className="relative z-10 max-w-xl">
            <h2 className="font-display max-w-lg text-3xl font-bold leading-[1.08] tracking-[-0.045em] sm:text-4xl">
              {headline}
            </h2>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground sm:text-base">
              {description}
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                to="/sign-in"
                className="inline-flex min-h-10 items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground transition hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                Sign in
              </Link>
              <Link
                to="/sign-up"
                className="inline-flex min-h-10 items-center justify-center rounded-lg border border-border bg-background/30 px-5 py-2.5 text-sm font-bold transition hover:border-primary/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                Create account
              </Link>
            </div>
          </div>

          <div
            className="pointer-events-none absolute inset-y-0 right-0 hidden w-64 place-items-center overflow-hidden text-foreground/80 lg:grid"
            aria-hidden="true"
          >
            <div className="absolute size-52 rounded-full border border-foreground/10" />
            <div className="absolute size-72 rounded-full border border-foreground/5" />
            <Icon
              className={`relative size-32 ${section === "library" || section === "psnRepair" ? "" : "stroke-[1.15]"}`}
            />
          </div>
        </section>

        <section className="mt-8" aria-labelledby="guest-explore-title">
          <h2 id="guest-explore-title" className="mb-3 text-base font-bold">
            Explore without signing in
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Link
              to="/search"
              className="group rounded-xl border border-border bg-surface p-5 transition hover:border-primary/50 hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <span
                className="mb-4 grid size-8 place-items-center rounded-lg bg-surface-2 text-foreground"
                aria-hidden="true"
              >
                <Search className="size-4" />
              </span>
              <strong className="block text-sm">Search games</strong>
              <span className="mt-1 block text-xs text-muted-foreground">
                Find something new to play.
              </span>
              <span className="mt-4 inline-flex items-center gap-1 text-xs font-bold">
                Browse catalog{" "}
                <ArrowUpRight
                  className="size-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                  aria-hidden="true"
                />
              </span>
            </Link>
            <Link
              to="/deals"
              className="group rounded-xl border border-border bg-surface p-5 transition hover:border-primary/50 hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <span
                className="mb-4 grid size-8 place-items-center rounded-lg bg-surface-2 text-foreground"
                aria-hidden="true"
              >
                <Tag className="size-4" />
              </span>
              <strong className="block text-sm">See price drops</strong>
              <span className="mt-1 block text-xs text-muted-foreground">
                Check live deals in your region.
              </span>
              <span className="mt-4 inline-flex items-center gap-1 text-xs font-bold">
                Browse deals{" "}
                <ArrowUpRight
                  className="size-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                  aria-hidden="true"
                />
              </span>
            </Link>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
