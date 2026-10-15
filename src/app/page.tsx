import type { Metadata } from "next";
import { Fraunces, Pacifico } from "next/font/google";
import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { BrandLogo } from "@/app/_components/brand-logo";

// Landing page (design "Landing page — Naquela Mesa" no canvas "Logo Nelson Gonçalves").
// Só frontend por enquanto: os botões ainda não levam a lugar nenhum (href="#"), exceto as âncoras da própria página.

const fraunces = Fraunces({ subsets: ["latin"], weight: ["500", "600"], variable: "--font-fraunces" });
const pacifico = Pacifico({ subsets: ["latin"], weight: "400", variable: "--font-pacifico" });

export const metadata: Metadata = {
  title: "Naquela Mesa — cardápio digital e pedidos para restaurantes",
  description: "Seu cliente pede pelo cardápio da loja no celular, sem baixar nada. Sua equipe recebe, prepara e imprime tudo num painel simples.",
};

const BRAND = "#D9622B";

// Paleta própria da landing (quente, sempre clara), fora dos tokens do app.
const palette = {
  "--nm-ink": "#3B2A20",
  "--nm-muted": "#6E5644",
  "--nm-cream": "#FBF5EC",
  "--nm-sand": "#F6EADB",
  "--nm-card": "#FFFCF7",
  "--nm-line": "#EBDCC8",
  "--nm-brand": BRAND,
  "--nm-cta": "#B5481C",
  "--nm-cta-hover": "#963A15",
  "--nm-accent-ink": "#8A3A17",
} as CSSProperties;

const display = "font-[family-name:var(--font-fraunces)] font-semibold";
const script = "font-[family-name:var(--font-pacifico)]";

const button =
  "inline-flex h-[46px] items-center justify-center gap-2 rounded-xl border border-transparent px-6 text-[15px] font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-[var(--nm-cta)]/40";
const primary = "bg-[var(--nm-cta)] text-white hover:bg-[var(--nm-cta-hover)]";
const outline = "border-[#E8D9C6] bg-[var(--nm-card)] text-[var(--nm-ink)] hover:bg-[var(--nm-sand)]";

const STEPS = [
  { title: "O cliente escolhe", text: "Abre o link da sua loja, monta o pedido e escolhe entrega, retirada ou mesa." },
  { title: "A cozinha recebe", text: "O pedido chega no painel com um aviso sonoro, e a comanda sai impressa ao aceitar." },
  { title: "O cliente acompanha", text: "Cada etapa aparece no link do pedido e pode ser avisada pelo WhatsApp." },
];

const MOCK_ITEMS = [
  { name: "Lasanha da casa", detail: "Porção individual ou família" },
  { name: "Pizza meio a meio", detail: "Escolha dois sabores" },
  { name: "Suco natural", detail: "Laranja ou limão" },
];

function Wrap({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("mx-auto w-full max-w-[1120px] px-4 sm:px-6", className)}>{children}</div>;
}

function Brand() {
  return (
    <a href="#" className={cn(script, "flex items-center gap-2.5 text-[21px] text-[var(--nm-brand)] sm:text-[26px]")}>
      <BrandLogo id="header" size={40} color={BRAND} className="size-[34px] sm:size-10" />
      Naquela Mesa
    </a>
  );
}

/** Celular com o cardápio de uma loja e a comanda do pedido ao lado (ilustração, sem dados reais). */
function HeroMockup() {
  return (
    <div aria-hidden="true" className="relative h-[400px] w-full max-w-[460px] justify-self-center sm:h-[480px]">
      <div className="absolute inset-[30px_0_0_16%] rounded-[32px] bg-[#F3E2CC]" />
      <div className="absolute top-0 left-0 h-[390px] w-[196px] rounded-[34px] bg-[var(--nm-ink)] p-[9px] shadow-[0_30px_60px_-24px_rgba(59,42,32,0.5)] sm:left-[30px] sm:h-[460px] sm:w-[230px]">
        <div className="flex size-full flex-col overflow-hidden rounded-[26px] bg-[var(--nm-card)]">
          <div className="bg-[var(--nm-brand)] px-4 pt-6 pb-4 text-white">
            <div className="text-[17px] font-semibold">Cantina da Vó</div>
            <div className="mt-[3px] text-[11px]">Aberto agora · Entrega e retirada</div>
          </div>
          <div className="flex flex-1 flex-col gap-2 p-3">
            {MOCK_ITEMS.map((item) => (
              <div key={item.name} className="rounded-xl border border-[#EFE2D2] bg-white p-2.5">
                <div className="text-xs font-semibold">{item.name}</div>
                <div className="mt-0.5 text-[11px] text-[var(--nm-muted)]">{item.detail}</div>
              </div>
            ))}
          </div>
          <div className="p-3">
            <div className="rounded-xl bg-[var(--nm-ink)] px-3 py-[11px] text-center text-xs font-semibold text-white">Fazer pedido</div>
          </div>
        </div>
      </div>
      <div className="absolute right-0 bottom-3.5 flex w-[190px] rotate-2 flex-col gap-2.5 rounded-2xl bg-white p-3.5 shadow-[0_24px_50px_-24px_rgba(59,42,32,0.45)] sm:bottom-[30px] sm:w-[240px] sm:p-[18px]">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold">Pedido #1042</div>
          <span className="rounded-full bg-[#FBE4D3] px-[9px] py-0.5 text-[11px] font-medium text-[var(--nm-accent-ink)]">Novo</span>
        </div>
        <div className="text-xs leading-relaxed text-[var(--nm-muted)]">
          Mesa 7
          <br />
          1× Lasanha da casa
          <br />
          1× Suco de laranja
        </div>
        <div className="rounded-[10px] bg-[var(--nm-cta)] p-[9px] text-center text-xs font-semibold text-white">Aceitar e imprimir</div>
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <div
      style={palette}
      className={cn(fraunces.variable, pacifico.variable, "min-h-dvh w-full bg-[var(--nm-cream)] font-sans text-[var(--nm-ink)]")}
    >
      <header>
        <Wrap className="flex h-16 items-center justify-between gap-6 sm:h-[76px]">
          <Brand />
          <nav aria-label="Principal" className="flex gap-2">
            <a href="#" className={cn(button, "hidden h-10 px-4 hover:bg-[#F3E6D4] md:inline-flex")}>
              Entrar
            </a>
            <a href="#comecar" className={cn(button, primary, "h-10 px-3.5 text-sm sm:px-[18px]")}>
              Criar minha loja
            </a>
          </nav>
        </Wrap>
      </header>

      <main>
        <section className="pt-6 pb-16 md:pt-14 md:pb-[88px]">
          <Wrap className="grid items-center gap-12 md:grid-cols-[1.1fr_1fr] md:gap-8 lg:gap-14">
            <div className="flex flex-col gap-6">
              <span className="self-start rounded-full border border-[#EBCFB4] bg-[#FFF6EC] px-3.5 py-[5px] text-[13px] font-medium text-[var(--nm-accent-ink)]">
                Cardápio digital para restaurantes
              </span>
              <h1 className={cn(display, "m-0 text-[33px] leading-[1.06] tracking-[-0.02em] sm:text-[40px] lg:text-[54px]")}>
                Pedidos como em casa, do celular do cliente para a sua cozinha.
              </h1>
              <p className="m-0 max-w-[32rem] text-base leading-[1.65] text-[var(--nm-muted)] sm:text-lg">
                Seu cliente pede pelo cardápio da loja no celular, sem baixar nada. Sua equipe recebe, prepara e imprime tudo num painel simples.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <a href="#comecar" className={cn(button, primary)}>
                  Criar minha loja
                </a>
                <a href="#" className={cn(button, outline)}>
                  Ver a loja demo
                </a>
              </div>
            </div>
            <HeroMockup />
          </Wrap>
        </section>

        <section id="como-funciona" aria-labelledby="como-funciona-titulo" className="bg-[var(--nm-sand)] py-16 md:py-[88px]">
          <Wrap className="flex flex-col gap-10">
            <h2 id="como-funciona-titulo" className={cn(display, "m-0 text-center text-[30px] leading-[1.15] tracking-[-0.015em] md:text-4xl")}>
              Como funciona
            </h2>
            <ol className="mx-auto grid w-full max-w-[520px] list-none gap-5 p-0 md:max-w-none md:grid-cols-3">
              {STEPS.map((step, index) => (
                <li key={step.title} className="flex flex-col gap-3 rounded-[18px] border border-[var(--nm-line)] bg-[var(--nm-card)] p-[22px] md:p-7">
                  <span
                    aria-hidden="true"
                    className={cn(display, "flex size-10 items-center justify-center rounded-full bg-[var(--nm-brand)] text-lg text-white")}
                  >
                    {index + 1}
                  </span>
                  <h3 className="m-0 text-lg font-semibold">{step.title}</h3>
                  <p className="m-0 text-[15px] leading-relaxed text-[var(--nm-muted)]">{step.text}</p>
                </li>
              ))}
            </ol>
          </Wrap>
        </section>

        <section id="comecar" aria-labelledby="comecar-titulo" className="py-16 md:py-[88px]">
          <Wrap className="flex flex-col items-center gap-5 text-center">
            <BrandLogo id="cta" size={88} color={BRAND} label="Logo Naquela Mesa" />
            <h2 id="comecar-titulo" className={cn(display, "m-0 text-[30px] leading-[1.15] tracking-[-0.015em] md:text-4xl")}>
              Vamos abrir a sua mesa?
            </h2>
            <p className="m-0 max-w-[30rem] text-[17px] leading-relaxed text-[var(--nm-muted)]">
              Sua loja começa com um cardápio pronto para pizzaria, hamburgueria ou lanchonete. É só ajustar e começar a vender.
            </p>
            <a href="#" className={cn(button, primary, "mt-2")}>
              Falar com a gente
            </a>
          </Wrap>
        </section>
      </main>

      <footer className="border-t border-[var(--nm-line)]">
        <Wrap className="flex flex-col items-start gap-4 py-6 text-[13px] text-[var(--nm-muted)] sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <span>
            <span className={cn(script, "text-[17px] text-[var(--nm-brand)]")}>Naquela Mesa</span> · cardápio digital e gestão de pedidos
          </span>
          <div className="flex gap-5">
            <a href="#" className="hover:text-[var(--nm-cta)]">
              Privacidade
            </a>
            <a href="#" className="hover:text-[var(--nm-cta)]">
              Entrar
            </a>
          </div>
        </Wrap>
      </footer>
    </div>
  );
}
