"use client";

import { Moon, Sun } from "lucide-react";
import { accents, useTheme } from "@/lib/theme";

export function ThemeSelector({ compact = false }: { compact?: boolean }) {
  const { mode, accent, setMode, setAccent } = useTheme();

  return (
    <div
      className={`rounded-xl border border-border bg-surface-2 p-3 ${
        compact ? "" : "space-y-3"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Theme
        </p>
        <div className="flex items-center rounded-md border border-border bg-background p-0.5">
          <button
            onClick={() => setMode("dark")}
            aria-label="Dark mode"
            aria-pressed={mode === "dark"}
            className={`grid size-6 place-items-center rounded transition ${
              mode === "dark"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground"
            }`}
          >
            <Moon className="size-3.5" />
          </button>
          <button
            onClick={() => setMode("light")}
            aria-label="Light mode"
            aria-pressed={mode === "light"}
            className={`grid size-6 place-items-center rounded transition ${
              mode === "light"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground"
            }`}
          >
            <Sun className="size-3.5" />
          </button>
        </div>
      </div>
      <div className={`flex items-center gap-1.5 ${compact ? "mt-2" : ""}`}>
        {accents.map((a) => (
          <button
            key={a.id}
            onClick={() => setAccent(a.id)}
            aria-label={`Accent ${a.name}`}
            aria-pressed={accent.id === a.id}
            title={a.name}
            className={`size-5 rounded-full ring-offset-2 ring-offset-surface-2 transition ${
              accent.id === a.id ? "ring-2 ring-foreground" : ""
            }`}
            style={{
              background: a.adaptiveSwatch
                ? "linear-gradient(135deg, #ffffff 0 50%, #0a0a0f 50% 100%)"
                : a.swatch,
              border: a.adaptiveSwatch ? "1px solid var(--border)" : undefined,
            }}
          />
        ))}
      </div>
    </div>
  );
}
