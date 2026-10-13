import type { StoreTheme } from "./settings";

const HEX_COLOR = /^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/;
const BLACK = "#000000";
const WHITE = "#FFFFFF";

// Luminância relativa da WCAG 2.x.
function relativeLuminance(hex: string): number {
  const match = HEX_COLOR.exec(hex);
  if (!match) throw new RangeError(`Cor inválida: ${hex}`);

  const [red, green, blue] = match.slice(1).map((channel) => {
    const value = Number.parseInt(channel, 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];

  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrastRatio(a: number, b: number): number {
  const [lighter, darker] = a > b ? [a, b] : [b, a];
  return (lighter + 0.05) / (darker + 0.05);
}

export function readableTextColor(hex: string): typeof BLACK | typeof WHITE {
  const luminance = relativeLuminance(hex);
  return contrastRatio(luminance, 0) >= contrastRatio(luminance, 1) ? BLACK : WHITE;
}

export function themeCssVariables(theme: StoreTheme) {
  return {
    "--brand-primary": theme.primary,
    "--brand-primary-foreground": readableTextColor(theme.primary),
    "--brand-secondary": theme.secondary,
    "--brand-secondary-foreground": readableTextColor(theme.secondary),
  };
}
