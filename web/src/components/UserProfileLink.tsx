import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

export function UserProfileLink({
  publicId,
  children,
  className,
}: {
  publicId: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link to="/users/$publicId" params={{ publicId }} className={className}>
      {children}
    </Link>
  );
}
