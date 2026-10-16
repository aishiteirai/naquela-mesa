import type { StoreTheme } from "@/modules/stores";
import { readableTextColor } from "@/modules/stores/client";

export type PanelPalette = "naquela" | "loja";

// "Cores da loja": a primária/secundária entram inline no wrapper do painel. O tint e o hover
// são derivados com color-mix; --tint-pct/--tint-base e --accent-loja são decididos no CSS por modo.
// A cor da loja nunca vira texto sobre fundo claro: só fundos, com o texto vindo de readableTextColor.
export function panelThemeVariables(theme: StoreTheme): Record<string, string> {
  if (theme.panelColors !== "store") return {};
  const primaryForeground = readableTextColor(theme.primary);
  return {
    "--primary": theme.primary,
    "--primary-foreground": primaryForeground,
    "--sidebar-primary": theme.primary,
    "--sidebar-primary-foreground": primaryForeground,
    "--ring": theme.primary,
    "--chart-1": theme.primary,
    "--chart-2": theme.secondary,
    "--primary-hover": `color-mix(in srgb, ${theme.primary} 85%, black)`,
    "--tint": `color-mix(in srgb, ${theme.primary} var(--tint-pct, 8%), var(--tint-base, white))`,
    "--accent": "var(--accent-loja)",
    "--sidebar-accent": "var(--accent-loja)",
  };
}
