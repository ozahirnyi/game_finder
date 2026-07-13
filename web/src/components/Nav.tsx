"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { Icon } from "@/components/Icon";
import { getAuthSnapshot, subscribeToAuthChanges } from "@/lib/api";

export function Nav() {
  const pathname = usePathname();
  const authed = useSyncExternalStore(subscribeToAuthChanges, getAuthSnapshot, () => false);
  const isCurrent = (href: string) => href === "/" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="site-header">
      <Link className="brand" href="/">
        <span className="brand-mark" aria-hidden="true">
          GF
        </span>
        Game Finder
      </Link>
      <nav className="nav-links" aria-label="Main navigation">
        <Link className="nav-link" href="/" aria-current={isCurrent("/") ? "page" : undefined}>
          <Icon name="search" />
          <span>Search</span>
        </Link>
        <Link className="nav-link" href="/deals" aria-current={isCurrent("/deals") ? "page" : undefined}>
          <Icon name="tag" />
          <span>Deals</span>
        </Link>
        {authed && (
          <Link className="nav-link" href="/steam" aria-current={isCurrent("/steam") ? "page" : undefined}>
            <Icon name="gamepad" />
            <span>Steam</span>
          </Link>
        )}
      </nav>
      <div className="auth-actions" aria-label="Account actions">
        {authed ? (
          <Link className="nav-button ghost" href="/profile" aria-current={isCurrent("/profile") ? "page" : undefined}>
            <Icon name="user" />
            <span>Profile</span>
          </Link>
        ) : (
          <>
            <Link className="nav-button ghost" href="/login" aria-current={isCurrent("/login") ? "page" : undefined}>
              <Icon name="log-in" />
              <span>Login</span>
            </Link>
            <Link
              className="nav-button primary"
              href="/register"
              aria-current={isCurrent("/register") ? "page" : undefined}
            >
              <Icon name="user-plus" />
              <span>Register</span>
            </Link>
          </>
        )}
      </div>
    </header>
  );
}
