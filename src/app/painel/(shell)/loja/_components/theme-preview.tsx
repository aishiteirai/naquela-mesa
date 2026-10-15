import Image from "next/image";
import { readableTextColor } from "@/modules/stores/client";

type Props = {
  name: string;
  logoUrl: string;
  bannerUrl: string;
  primary: string;
  secondary: string;
  font: "sans" | "serif";
};

const HEADING_FONTS = { sans: "var(--font-geist-sans)", serif: "var(--font-lora)" } as const;

// Mini-celular com o topo do cardápio. O cardápio público é sempre claro, então a prévia usa
// fundo branco fixo (não os tokens do painel, que podem estar no modo escuro).
export function ThemePreview({ name, logoUrl, bannerUrl, primary, secondary, font }: Props) {
  const onPrimary = readableTextColor(primary);
  const heading = { fontFamily: HEADING_FONTS[font] };

  return (
    <figure className="flex flex-col items-center gap-2">
      <div
        data-testid="theme-preview"
        className="w-64 overflow-hidden rounded-[2rem] border-8 border-foreground/80 shadow-lg"
        style={{ backgroundColor: "#ffffff", color: "#0a0a0a" }}
      >
        <div className="relative aspect-[3/1]">
          {bannerUrl ? (
            <Image src={bannerUrl} alt="" fill unoptimized className="object-cover" />
          ) : (
            <div className="size-full" style={{ backgroundImage: `linear-gradient(to bottom right, ${primary}, ${secondary})` }} />
          )}
        </div>
        <div className="flex items-end gap-2 px-3">
          <div className="-mt-6 size-12 shrink-0 overflow-hidden rounded-xl border-4 border-white" style={{ backgroundColor: primary }}>
            {logoUrl ? (
              <Image src={logoUrl} alt="" width={48} height={48} unoptimized className="size-full object-cover" />
            ) : (
              <span className="grid size-full place-items-center font-bold" style={{ ...heading, color: onPrimary }}>
                {name.charAt(0)}
              </span>
            )}
          </div>
          <p className="truncate py-1 font-bold" style={heading}>
            {name || "Nome da loja"}
          </p>
        </div>
        <div className="px-3 pt-2">
          <span className="inline-block rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ backgroundColor: secondary, color: readableTextColor(secondary) }}>
            Aberto agora
          </span>
        </div>
        <p className="px-3 pt-3 text-sm font-semibold" style={heading}>
          Pizzas
        </p>
        <div className="mx-3 mt-1 flex items-center gap-2 border-b pb-2" style={{ borderColor: "#e5e5e5" }}>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-xs font-medium">Calabresa</span>
            <span className="text-[10px]" style={{ color: "#737373" }}>
              a partir de R$ 39,90
            </span>
          </div>
          <span aria-hidden="true" className="grid size-6 place-items-center rounded-full text-sm font-bold" style={{ backgroundColor: primary, color: onPrimary }}>
            +
          </span>
        </div>
        <div className="p-3 pt-10">
          <span data-testid="preview-cart-button" className="block rounded-lg py-2 text-center text-xs font-semibold" style={{ backgroundColor: primary, color: onPrimary }}>
            Ver sacola (2)
          </span>
        </div>
      </div>
      <figcaption className="text-xs text-muted-foreground">Prévia do cardápio</figcaption>
    </figure>
  );
}
