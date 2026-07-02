"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSyncExternalStore } from "react";
import { clearToken, getAuthSnapshot, subscribeToAuthChanges } from "@/lib/api";

export function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const authed = useSyncExternalStore(subscribeToAuthChanges, getAuthSnapshot, () => false);

  function logout() {
    clearToken();
    router.push("/login");
  }

  return (
    <header className="site-header">
      <Link className="brand" href="/">
        <span className="brand-mark" aria-hidden="true">
          GF
        </span>
        Game Finder
      </Link>
      <nav className="nav-links" aria-label="Main navigation">
        <Link href="/" aria-current={pathname === "/" ? "page" : undefined}>
          Search
        </Link>
        {authed && (
          <Link href="/favorites" aria-current={pathname === "/favorites" ? "page" : undefined}>
            Favorites
          </Link>
        )}
      </nav>
      <div className="auth-actions">
        {authed ? (
          <button className="nav-button ghost" type="button" onClick={logout}>
            Log out
          </button>
        ) : (
          <>
            <Link className="nav-button ghost" href="/login" aria-current={pathname === "/login" ? "page" : undefined}>
              Login
            </Link>
            <Link
              className="nav-button primary"
              href="/register"
              aria-current={pathname === "/register" ? "page" : undefined}
            >
              Register
            </Link>
          </>
        )}
      </div>
    </header>
  );
}
