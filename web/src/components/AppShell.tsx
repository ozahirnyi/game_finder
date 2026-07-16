"use client";

import type { ReactNode } from "react";
import { Nav } from "./Nav";
import styles from "./app-shell.module.css";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className={styles.shell}>
      <Nav />
      <main className={styles.content}>{children}</main>
    </div>
  );
}
