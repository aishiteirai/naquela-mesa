import { Fraunces, Pacifico } from "next/font/google";
import type { CSSProperties } from "react";

// Estética da marca Naquela Mesa (landing page e telas de conta): paleta quente, sempre clara,
// Fraunces nos títulos e Pacifico no nome da marca.

export const fraunces = Fraunces({ subsets: ["latin"], weight: ["500", "600"], variable: "--font-fraunces" });
export const pacifico = Pacifico({ subsets: ["latin"], weight: "400", variable: "--font-pacifico" });

export const BRAND_COLOR = "#D9622B";

export const brandFonts = `${fraunces.variable} ${pacifico.variable}`;

const palette = {
  ink: "#3B2A20",
  muted: "#6E5644",
  cream: "#FBF5EC",
  sand: "#F6EADB",
  card: "#FFFCF7",
  line: "#EBDCC8",
  input: "#E8D9C6",
  cta: "#B5481C",
  ctaHover: "#963A15",
  accentInk: "#8A3A17",
};

/** Variáveis `--nm-*` da paleta, mais os tokens do shadcn trocados por ela (campos e botões seguem a marca). */
export const brandThemeStyle = {
  "--nm-ink": palette.ink,
  "--nm-muted": palette.muted,
  "--nm-cream": palette.cream,
  "--nm-sand": palette.sand,
  "--nm-card": palette.card,
  "--nm-line": palette.line,
  "--nm-brand": BRAND_COLOR,
  "--nm-cta": palette.cta,
  "--nm-cta-hover": palette.ctaHover,
  "--nm-accent-ink": palette.accentInk,
  "--background": palette.cream,
  "--foreground": palette.ink,
  "--card": palette.card,
  "--card-foreground": palette.ink,
  "--primary": palette.cta,
  "--primary-foreground": "#FFFFFF",
  "--muted": palette.sand,
  "--muted-foreground": palette.muted,
  "--accent": palette.sand,
  "--accent-foreground": palette.ink,
  "--border": palette.line,
  "--input": palette.input,
  "--ring": palette.cta,
} as CSSProperties;

export const displayFont = "font-[family-name:var(--font-fraunces)] font-semibold";
export const scriptFont = "font-[family-name:var(--font-pacifico)]";
