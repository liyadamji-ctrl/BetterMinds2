"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { DM_Sans, Newsreader } from "next/font/google";

const display = Newsreader({
  subsets: ["latin"],
  weight: ["400", "500"],
  adjustFontFallback: false,
  variable: "--font-display-mw",
  display: "swap",
});
const sans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-sans-mw-src",
  display: "swap",
});

type Theme = "light" | "dark";
const STORAGE_KEY = "ts-theme"; // shared with the company/admin shell so the choice follows the person

type Ctx = { effective: Theme; toggle: () => void };
const ThemeCtx = createContext<Ctx>({ effective: "light", toggle: () => {} });
export const useMeadowTheme = () => useContext(ThemeCtx);

/**
 * Wraps a page in the Meadow design system: tokens, fonts and light/dark.
 * Follows the OS until the person picks a theme with the toggle.
 */
export function MeadowScope({ children, className = "" }: { children: ReactNode; className?: string }) {
  const [theme, setTheme] = useState<Theme | null>(null);
  const [osDark, setOsDark] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "light" || saved === "dark") setTheme(saved);
    } catch {}
    setOsDark(window.matchMedia("(prefers-color-scheme: dark)").matches);
  }, []);

  const effective: Theme = theme ?? (osDark ? "dark" : "light");

  function toggle() {
    const next: Theme = effective === "dark" ? "light" : "dark";
    setTheme(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {}
  }

  return (
    <ThemeCtx.Provider value={{ effective, toggle }}>
      <div
        className={`theme-meadow min-h-screen ${display.variable} ${sans.variable} ${className}`}
        data-theme={theme ?? undefined}
      >
        {children}
      </div>
    </ThemeCtx.Provider>
  );
}
