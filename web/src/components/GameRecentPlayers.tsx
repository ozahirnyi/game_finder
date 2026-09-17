import { Avatar } from "@/components/GameCover";
import { UserProfileLink } from "@/components/UserProfileLink";
import { Panel, SectionHeader } from "@/components/ui-bits";
import type { RecentGamePlayer } from "@/lib/api";

type Props = {
  players: RecentGamePlayer[];
  isPending: boolean;
  isError: boolean;
  onRetry: () => void;
};

export function GameRecentPlayers({ players, isPending, isError, onRetry }: Props) {
  const ranked = [...players].sort((a, b) => b.playtime_2weeks - a.playtime_2weeks);

  return (
    <section>
      <SectionHeader title="Recently active players" hint="Steam, last two weeks" />
      <Panel className="divide-y divide-border">
        {isPending ? (
          <p className="px-4 py-3 text-sm text-muted-foreground">Loading recent players…</p>
        ) : isError ? (
          <div className="px-4 py-3 text-sm text-muted-foreground">
            <p>Recent player activity is unavailable.</p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-3 rounded-lg border border-border px-3 py-1.5 text-xs font-bold"
            >
              Retry activity
            </button>
          </div>
        ) : ranked.length === 0 ? (
          <p className="px-4 py-3 text-sm text-muted-foreground">
            No public players logged time in the last two weeks.
          </p>
        ) : (
          ranked.map((player) => (
            <div
              key={player.id}
              data-testid="recent-player-row"
              className="flex items-center gap-3 px-4 py-3"
            >
              <Avatar
                from="#7c3aed"
                to="#111827"
                name={player.display_name}
                image={player.avatar ?? undefined}
                imageAlt={player.display_name}
                className="size-9 shrink-0 rounded-full"
              />
              <UserProfileLink
                publicId={player.public_id}
                className="min-w-0 flex-1 truncate text-sm font-bold hover:text-primary"
              >
                {player.display_name}
              </UserProfileLink>
              <p className="shrink-0 text-xs text-muted-foreground">
                {(player.playtime_2weeks / 60).toFixed(1)} h
              </p>
            </div>
          ))
        )}
      </Panel>
    </section>
  );
}
