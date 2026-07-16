"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Mode = "dark" | "light";
export type Accent = {
  id: string;
  name: string;
  swatch: string; // hex for the picker dot
  primary: string; // hsl(...) applied to --primary and --ring
  primaryForeground: string;
  // Optional mode-specific overrides — used by the adaptive "mono" accent
  // which flips to white in dark mode and black in light mode.
  darkPrimary?: string;
  darkPrimaryForeground?: string;
  lightPrimary?: string;
  lightPrimaryForeground?: string;
  adaptiveSwatch?: boolean;
};

export const accents: Accent[] = [
  {
    id: "mono",
    name: "Mono",
    swatch: "#ffffff",
    adaptiveSwatch: true,
    primary: "hsl(0 0% 100%)",
    primaryForeground: "hsl(240 10% 4%)",
    darkPrimary: "hsl(0 0% 100%)",
    darkPrimaryForeground: "hsl(240 10% 4%)",
    lightPrimary: "hsl(240 10% 4%)",
    lightPrimaryForeground: "hsl(0 0% 100%)",
  },
  { id: "emerald", name: "Emerald", swatch: "#22c55e", primary: "hsl(142 76% 45%)", primaryForeground: "hsl(240 10% 4%)" },
  { id: "cyan", name: "Cyan", swatch: "#06b6d4", primary: "hsl(189 94% 43%)", primaryForeground: "hsl(240 10% 4%)" },
  { id: "violet", name: "Violet", swatch: "#8b5cf6", primary: "hsl(262 83% 62%)", primaryForeground: "hsl(0 0% 100%)" },
  { id: "orange", name: "Orange", swatch: "#f97316", primary: "hsl(24 95% 55%)", primaryForeground: "hsl(240 10% 4%)" },
  { id: "rose", name: "Rose", swatch: "#f43f5e", primary: "hsl(346 84% 58%)", primaryForeground: "hsl(0 0% 100%)" },
];

type ThemeCtx = {
  mode: Mode;
  accent: Accent;
  setMode: (m: Mode) => void;
  setAccent: (id: string) => void;
};

const Ctx = createContext<ThemeCtx | null>(null);

const KEY = "gf.theme";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<Mode>("dark");
  const [accent, setAccentState] = useState<Accent>(accents[1]);

  // Load persisted
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const p = JSON.parse(raw) as { mode?: Mode; accentId?: string };
        if (p.mode) setModeState(p.mode);
        if (p.accentId) {
          const a = accents.find((x) => x.id === p.accentId);
          if (a) setAccentState(a);
        }
      }
    } catch {}
  }, []);

  // Apply to <html>
  useEffect(() => {
    const html = document.documentElement;
    html.classList.toggle("dark", mode === "dark");
    html.classList.toggle("light", mode === "light");
    const primary =
      (mode === "dark" ? accent.darkPrimary : accent.lightPrimary) ?? accent.primary;
    const primaryForeground =
      (mode === "dark" ? accent.darkPrimaryForeground : accent.lightPrimaryForeground) ??
      accent.primaryForeground;
    html.style.setProperty("--primary", primary);
    html.style.setProperty("--ring", primary);
    html.style.setProperty("--primary-foreground", primaryForeground);
    try {
      localStorage.setItem(KEY, JSON.stringify({ mode, accentId: accent.id }));
    } catch {}
  }, [mode, accent]);


  return (
    <Ctx.Provider
      value={{
        mode,
        accent,
        setMode: setModeState,
        setAccent: (id) => {
          const a = accents.find((x) => x.id === id);
          if (a) setAccentState(a);
        },
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useTheme() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useTheme must be inside ThemeProvider");
  return c;
}
