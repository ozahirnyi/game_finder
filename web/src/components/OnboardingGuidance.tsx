import { Link } from "@tanstack/react-router";
import { Panel } from "@/components/ui-bits";
import type { OnboardingSummary } from "@/lib/api";

type GuidanceTarget = "/account" | "/psn-import" | "/search" | "/wishlist" | "/friends";

type GuidanceCardProps = {
  title: string;
  description: string;
  actions: { label: string; to: GuidanceTarget }[];
};

function GuidanceCard({ title, description, actions }: GuidanceCardProps) {
  return (
    <div className="rounded-xl border border-border bg-background/70 p-4">
      <h3 className="text-sm font-bold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {actions.map((action) => (
          <Link
            key={action.to}
            to={action.to}
            className="rounded-lg border border-border px-3 py-2 text-sm font-bold text-primary transition hover:border-primary/50"
          >
            {action.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

export function OnboardingGuidance({
  summary,
  isPending,
  isError,
  onRetry,
  compact = false,
}: {
  summary?: OnboardingSummary;
  isPending: boolean;
  isError: boolean;
  onRetry: () => void;
  compact?: boolean;
}) {
  const className = compact ? "mb-6 p-4" : "mb-8 p-6";
  const testId = compact ? "onboarding-guidance-compact" : "onboarding-guidance";

  if (isPending) {
    return (
      <Panel testId={testId} className={`${className} text-sm text-muted-foreground`}>
        Preparing your setup…
      </Panel>
    );
  }

  if (isError) {
    return (
      <Panel testId={testId} className={`${className} text-sm text-muted-foreground`}>
        <p>Setup guidance is unavailable</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 rounded-lg border border-border px-3 py-2 text-sm font-bold"
        >
          Retry setup guidance
        </button>
      </Panel>
    );
  }

  if (!summary) return null;

  const libraryComplete = summary.steam_linked || summary.psn_library_games > 0;
  const cards: GuidanceCardProps[] = [
    ...(!libraryComplete
      ? [
          {
            title: "Connect a library",
            description: "Connect Steam or import your PlayStation library.",
            actions: [
              { label: "Connect Steam", to: "/account" as const },
              { label: "Import PlayStation", to: "/psn-import" as const },
            ],
          },
        ]
      : []),
    ...(summary.wishlist_games === 0
      ? [
          {
            title: "Add a wishlist game",
            description: "Save a game so PlayFinder can watch its price.",
            actions: [{ label: "Add a wishlist game", to: "/search" as const }],
          },
        ]
      : []),
    ...(summary.wishlist_games > 0 && summary.price_alerts === 0
      ? [
          {
            title: "Create your first price alert",
            description: "Choose a saved game and set a price target.",
            actions: [{ label: "Create your first price alert", to: "/wishlist" as const }],
          },
        ]
      : []),
    ...(summary.friends === 0
      ? [
          {
            title: "Find friends",
            description: "Add players to compare libraries and play together.",
            actions: [{ label: "Find friends", to: "/friends" as const }],
          },
        ]
      : []),
  ];

  if (cards.length === 0) return null;

  return (
    <Panel testId={testId} className={className}>
      {!compact && (
        <div className="mb-4">
          <p className="label-mono text-primary">Get started</p>
          <h2 className="mt-1 text-xl font-bold">Make PlayFinder yours</h2>
        </div>
      )}
      <div className="space-y-3">
        {cards.map((card) => (
          <GuidanceCard key={card.title} {...card} />
        ))}
      </div>
    </Panel>
  );
}
