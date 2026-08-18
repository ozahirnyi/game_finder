import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

export function UserProfileLink({
  publicId,
  children,
  className,
  "aria-label": ariaLabel,
}: {
  publicId: string;
  children: ReactNode;
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <Link to="/users/$publicId" params={{ publicId }} className={className} aria-label={ariaLabel}>
      {children}
    </Link>
  );
}
