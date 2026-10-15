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

// Fontes carregadas no layout raiz (next/font) e expostas como CSS vars no <html>.
const HEADING_FONTS: Record<StoreTheme["font"], string> = {
  sans: "var(--font-geist-sans)",
  serif: "var(--font-lora)",
};

// --brand-* atendem as telas atuais; --primary/--ring/--heading-font fazem os componentes shadcn
// e os títulos dentro da loja usarem a marca dela.
export function themeCssVariables(theme: StoreTheme) {
  const primaryForeground = readableTextColor(theme.primary);
  // shadcn desenha o foco em ring/50; uma cor primária clara ficaria quase invisível sobre o branco,
  // então o anel só usa a primária quando ela é escura (texto branco).
  return {
    "--brand-primary": theme.primary,
    "--brand-primary-foreground": primaryForeground,
    "--brand-secondary": theme.secondary,
    "--brand-secondary-foreground": readableTextColor(theme.secondary),
    "--primary": theme.primary,
    "--primary-foreground": primaryForeground,
    "--ring": primaryForeground === "#FFFFFF" ? theme.primary : "#000000",
    "--heading-font": HEADING_FONTS[theme.font],
  };
}
