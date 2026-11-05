import { Inter, JetBrains_Mono, Newsreader } from "next/font/google";

// Calm Coast type: Newsreader for display lines, Inter for everything you read and tap.
const display = Newsreader({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  adjustFontFallback: false,
  variable: "--font-display-ts",
  display: "swap",
});
const sans = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-sans-ts",
  display: "swap",
});
const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["500"],
  variable: "--font-mono-ts-src",
  display: "swap",
});

export const teamsteadFontClasses = `${display.variable} ${sans.variable} ${mono.variable}`;
