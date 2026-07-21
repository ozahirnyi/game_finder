"use client";

import { Link, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { useAuthState } from "@/hooks/useAuthState";
import styles from "./app-shell.module.css";

const publicDestinations = [
  ["Home", "/"],
  ["Search", "/search"],
  ["Deals", "/deals"],
] as const;

const protectedDestinations = [
  ["Library", "/library"],
  ["Wishlist", "/wishlist"],
  ["Friends", "/friends"],
  ["Steam", "/steam"],
  ["PSN", "/psn"],
  ["Profile", "/profile"],
] as const;

export function Nav() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const authed = useAuthState();
  const [menuOpen, setMenuOpen] = useState(false);
  const isCurrent = (href: string) =>
    href === "/"
      ? pathname === href
      : pathname === href || pathname.startsWith(`${href}/`);
  const destinations = authed
    ? [...publicDestinations, ...protectedDestinations]
    : publicDestinations;
  const linkClass = (isOpen: boolean) =>
    `${styles.navigation} ${isOpen ? styles.navigationOpen : ""}`;
  const accountClass = (isOpen: boolean) =>
    `${styles.account} ${isOpen ? styles.accountOpen : ""}`;

  return (
    <header className={styles.rail}>
      <Link className={styles.brand} to="/">
        <span className={styles.brandMark} aria-hidden="true">
          GF
        </span>
        Game Finder
      </Link>
      <button
        aria-controls="mobile-navigation"
        aria-expanded={menuOpen}
        className={styles.menuButton}
        onClick={() => setMenuOpen((open) => !open)}
        type="button"
      >
        Menu
      </button>
      <nav
        className={linkClass(menuOpen)}
        id="mobile-navigation"
        aria-label="Main navigation"
      >
        {destinations.map(([label, href]) => (
          <Link
            className={styles.link}
            to={href}
            key={href}
            aria-current={isCurrent(href) ? "page" : undefined}
          >
            {label}
          </Link>
        ))}
      </nav>
      <div className={accountClass(menuOpen)} aria-label="Account actions">
        {authed ? (
          <span className={styles.accountStatus}>Signed in</span>
        ) : (
          <>
            <Link
              className={styles.accountLink}
              to="/login"
              aria-current={isCurrent("/login") ? "page" : undefined}
            >
              Sign in
            </Link>
            <Link
              className={`${styles.accountLink} ${styles.signUp}`}
              to="/register"
              aria-current={isCurrent("/register") ? "page" : undefined}
            >
              Create account
            </Link>
          </>
        )}
      </div>
    </header>
  );
}
