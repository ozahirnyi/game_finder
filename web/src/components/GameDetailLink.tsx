import { Link, useRouterState } from "@tanstack/react-router";
import type { ComponentProps, ReactNode } from "react";

type GameDetailLinkProps = Omit<
  ComponentProps<typeof Link>,
  "to" | "params" | "search" | "children"
> & {
  gameId: string;
  search?: Record<string, unknown>;
  children: ReactNode;
};

/** Link to a game while preserving the page the user opened it from. */
export function GameDetailLink({ gameId, search, children, ...props }: GameDetailLinkProps) {
  const returnTo = useRouterState({ select: (state) => state.location.href });

  return (
    <Link
      to="/games/$gameId"
      params={{ gameId }}
      search={{ ...search, returnTo } as never}
      {...props}
    >
      {children}
    </Link>
  );
}
