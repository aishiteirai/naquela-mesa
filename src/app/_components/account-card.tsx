import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { BrandLogo } from "./brand-logo";
import { BRAND_COLOR, brandFonts, brandThemeStyle, displayFont, scriptFont } from "./brand-theme";

// Campos e botões das telas de conta no tamanho dos botões da landing (46 px, cantos de 12 px).
const roomyControls =
  "[&_[data-slot=input]]:h-11 [&_[data-slot=input]]:rounded-xl [&_[data-slot=input]]:bg-white [&_[data-slot=input]]:px-3.5 [&_[data-slot=button]]:h-[46px] [&_[data-slot=button]]:rounded-xl [&_[data-slot=button]]:text-[15px]";

/**
 * Moldura das telas de conta (login, convite, conta sem loja), na estética da landing page:
 * marca no topo, cartão creme com título em Fraunces e, no desktop, um painel ilustrado ao lado.
 */
export function AccountCard({ title, description, children }: { title: string; description?: ReactNode; children?: ReactNode }) {
  return (
    <div style={brandThemeStyle} className={cn(brandFonts, "flex min-h-dvh w-full bg-background text-foreground")}>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center px-4 sm:h-[76px] sm:px-8">
          <Link href="/" className={cn(scriptFont, "flex items-center gap-2.5 text-[21px] text-[var(--nm-brand)] sm:text-[26px]")}>
            <BrandLogo id="account-header" size={40} color={BRAND_COLOR} className="size-[34px] sm:size-10" />
            Naquela Mesa
          </Link>
        </header>

        <main className="flex flex-1 items-center justify-center px-4 pt-4 pb-12 sm:px-8">
          <section
            aria-labelledby="account-title"
            className={cn(
              "flex w-full max-w-[420px] flex-col gap-6 rounded-[18px] border border-border bg-card p-6 shadow-[0_24px_50px_-28px_rgba(59,42,32,0.35)] sm:p-8",
              roomyControls,
            )}
          >
            <div className="flex flex-col gap-2">
              <h1 id="account-title" className={cn(displayFont, "m-0 text-[28px] leading-tight tracking-[-0.015em]")}>
                {title}
              </h1>
              {description && <p className="m-0 text-[15px] leading-relaxed text-muted-foreground">{description}</p>}
            </div>
            {children}
          </section>
        </main>

        <footer className="px-4 pb-6 text-[13px] text-muted-foreground sm:px-8">
          <span className={cn(scriptFont, "text-[15px] text-[var(--nm-brand)]")}>Naquela Mesa</span> · cardápio digital e gestão de pedidos
        </footer>
      </div>

      <aside aria-hidden="true" className="relative hidden w-[44%] max-w-[640px] overflow-hidden bg-[var(--nm-sand)] lg:flex">
        <div className="absolute -right-24 -bottom-24 size-[420px] rounded-full bg-[#F3E2CC]" />
        <div className="relative m-auto flex max-w-[360px] flex-col items-center gap-6 p-10 text-center">
          <BrandLogo id="account-aside" size={160} color={BRAND_COLOR} />
          <p className={cn(displayFont, "m-0 text-[34px] leading-[1.1] tracking-[-0.02em]")}>Pedidos como em casa.</p>
          <p className="m-0 text-base leading-relaxed text-muted-foreground">
            Do celular do cliente para a sua cozinha: receba, prepare e imprima tudo num painel simples.
          </p>
        </div>
      </aside>
    </div>
  );
}
