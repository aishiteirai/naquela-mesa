import type { Metadata } from "next";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { BrandLogo } from "@/app/_components/brand-logo";
import {
  BRAND_COLOR,
  brandFonts,
  brandThemeStyle,
  displayFont,
  scriptFont,
} from "@/app/_components/brand-theme";

// Landing page: o universo da mesa (toalha xadrez, comanda impressa) para mostrar o software como ele é —
// cardápio no celular, sacola, painel da cozinha e acompanhamento. As miniaturas de tela são ilustrações (aria-hidden);
// o conteúdo para leitura está nos textos ao lado delas.
//
// "Entrar em contato" ainda não tem destino definido (CONTACT_HREF).

export const metadata: Metadata = {
  title: "Naquela Mesa",
  description:
    "Cardápio digital, sacola, painel de pedidos e comanda impressa num só lugar. O cliente pede pelo link da sua loja, sem baixar app; sua equipe recebe, prepara e avisa pelo WhatsApp.",
  openGraph: {
    title: "Naquela Mesa",
    description:
      "Cardápio digital, sacola, painel de pedidos e comanda impressa num só lugar. O cliente pede pelo link da sua loja, sem baixar app; sua equipe recebe, prepara e avisa pelo WhatsApp.",
    type: "website",
  },
};

const CONTACT_HREF = "#contato";

// Toalha xadrez: duas listras cruzadas na cor da marca, bem transparentes.
const gingham: CSSProperties = {
  backgroundImage:
    "repeating-linear-gradient(0deg, rgba(217,98,43,0.07) 0 18px, transparent 18px 36px), repeating-linear-gradient(90deg, rgba(217,98,43,0.07) 0 18px, transparent 18px 36px)",
};

// Borda serrilhada da comanda (papel térmico rasgado).
const receiptEdge: CSSProperties = {
  backgroundImage:
    "linear-gradient(-45deg, transparent 7px, #FFFDF8 0), linear-gradient(45deg, transparent 7px, #FFFDF8 0)",
  backgroundSize: "14px 14px",
  backgroundRepeat: "repeat-x",
  backgroundPosition: "left bottom",
};

const button =
  "inline-flex h-12 items-center justify-center gap-2 rounded-full px-6 text-[15px] font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-[var(--nm-cta)]/40";
const primary = "bg-[var(--nm-cta)] text-white hover:bg-[var(--nm-cta-hover)]";
const quiet =
  "text-[var(--nm-ink)] underline decoration-[var(--nm-line)] decoration-2 underline-offset-[6px] hover:decoration-[var(--nm-cta)]";

function Wrap({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn("mx-auto w-full max-w-[1160px] px-4 sm:px-6", className)}
    >
      {children}
    </div>
  );
}

function Eyebrow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "m-0 font-mono text-xs tracking-[0.18em] text-[var(--nm-accent-ink)] uppercase",
        className,
      )}
    >
      {children}
    </p>
  );
}

/* ---------- Miniaturas do produto (ilustrações) ---------- */

function PhoneMenu() {
  const items = [
    { name: "Calabresa", price: "a partir de R$ 34,90", tone: "#C2410C" },
    { name: "Margherita", price: "a partir de R$ 34,90", tone: "#B45309" },
    { name: "Portuguesa", price: "a partir de R$ 37,90", tone: "#9A3412" },
  ];
  return (
    <div className="w-[236px] rounded-[38px] bg-[var(--nm-ink)] p-[9px] shadow-[0_40px_70px_-30px_rgba(59,42,32,0.55)]">
      <div className="overflow-hidden rounded-[30px] bg-[#FFFDF8]">
        <div className="relative h-20 bg-[linear-gradient(135deg,#B91C1C,#F59E0B)]">
          <div className="absolute -bottom-5 left-3 grid size-11 place-items-center rounded-xl border-[3px] border-[#FFFDF8] bg-[#B91C1C] text-lg font-bold text-white">
            P
          </div>
        </div>
        <div className="px-3 pt-6 pb-2">
          <div className="text-[15px] font-bold">Pizzaria do Bairro</div>
          <div className="mt-0.5 text-[10px] text-[var(--nm-muted)]">
            Entrega ~45 min · Taxa R$ 6,00
          </div>
          <div className="mt-2 flex gap-1.5">
            <span className="rounded-full bg-[#B91C1C] px-2.5 py-1 text-[10px] font-medium text-white">
              Pizzas
            </span>
            <span className="rounded-full bg-[#F3EBDF] px-2.5 py-1 text-[10px] font-medium">
              Bebidas
            </span>
            <span className="rounded-full bg-[#F3EBDF] px-2.5 py-1 text-[10px] font-medium">
              Doces
            </span>
          </div>
        </div>
        <ul className="m-0 list-none divide-y divide-[#EFE2D2] p-0 px-3">
          {items.map((item) => (
            <li key={item.name} className="flex items-center gap-2 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="text-[12px] font-semibold">{item.name}</div>
                <div className="text-[10px] text-[var(--nm-muted)]">
                  {item.price}
                </div>
              </div>
              <div
                className="relative size-10 shrink-0 rounded-lg"
                style={{
                  background: `radial-gradient(circle at 35% 35%, #FBBF24 0 18%, ${item.tone} 19% 60%, #F5DEB3 61%)`,
                }}
              >
                <span className="absolute -right-1.5 -bottom-1.5 grid size-5 place-items-center rounded-full bg-[#B91C1C] text-[12px] leading-none font-bold text-white">
                  +
                </span>
              </div>
            </li>
          ))}
        </ul>
        <div className="p-3">
          <div className="rounded-xl bg-[#B91C1C] px-3 py-2.5 text-[11px] font-semibold text-white">
            Ver sacola (3)
          </div>
        </div>
      </div>
    </div>
  );
}

function Receipt({ animated = false }: { animated?: boolean }) {
  return (
    <div
      className={cn(
        "w-[228px] -rotate-2",
        animated &&
          "motion-safe:animate-[nm-print_1.4s_cubic-bezier(.2,.7,.2,1)_0.4s_both]",
      )}
    >
      <div className="bg-[#FFFDF8] px-5 pt-5 pb-4 font-mono text-[11px] leading-[1.65] text-[#2A1F18] shadow-[0_30px_50px_-30px_rgba(59,42,32,0.6)]">
        <div className="text-center font-bold tracking-wide">
          PIZZARIA DO BAIRRO
        </div>
        <div className="text-center text-[13px] font-bold">PEDIDO #0152</div>
        <div className="text-center">16/10 · 19:42</div>
        <div className="my-2 border-t border-dashed border-[#2A1F18]/50" />
        <div className="font-bold">DELIVERY</div>
        <div>Maria Silva · 98888-7777</div>
        <div>Rua das Flores, 123 - Centro</div>
        <div className="my-2 border-t border-dashed border-[#2A1F18]/50" />
        <div className="flex justify-between">
          <span>1x Calabresa (G)</span>
          <span>56,90</span>
        </div>
        <div className="pl-2">+ Borda: Catupiry</div>
        <div className="flex justify-between">
          <span>1x ½ Margherita ½ Portuguesa</span>
        </div>
        <div className="flex justify-end">
          <span>50,90</span>
        </div>
        <div className="flex justify-between">
          <span>1x Coca-Cola 2L</span>
          <span>14,00</span>
        </div>
        <div className="my-2 border-t border-dashed border-[#2A1F18]/50" />
        <div className="flex justify-between font-bold">
          <span>TOTAL</span>
          <span>R$ 127,80</span>
        </div>
        <div>Pagamento: Pix</div>
      </div>
      <div aria-hidden="true" className="h-3.5" style={receiptEdge} />
    </div>
  );
}

function MiniSizes() {
  return (
    <div className="flex flex-col gap-2">
      {[
        ["Broto", "R$ 34,90", true],
        ["Média", "R$ 46,90", false],
        ["Grande", "R$ 56,90", false],
      ].map(([size, price, on]) => (
        <div
          key={String(size)}
          className={cn(
            "flex items-center justify-between rounded-lg border px-3 py-2 text-[12px]",
            on
              ? "border-[var(--nm-cta)] bg-[#FBEADF]"
              : "border-[#EBDCC8] bg-white",
          )}
        >
          <span className="flex items-center gap-2">
            <span
              className={cn(
                "size-3 rounded-full border-2",
                on
                  ? "border-[var(--nm-cta)] bg-[radial-gradient(circle,var(--nm-cta)_40%,transparent_45%)]"
                  : "border-[#D8C6B0]",
              )}
            />
            {size}
          </span>
          <span className="text-[var(--nm-muted)]">{price}</span>
        </div>
      ))}
    </div>
  );
}

function MiniSteps() {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-[#EBDCC8] bg-white p-3 text-[12px]">
      <div className="flex items-center justify-between font-semibold">
        <span>Seus dados</span>
        <span className="font-normal text-[var(--nm-muted)]">3 de 4</span>
      </div>
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((step) => (
          <span
            key={step}
            className={cn(
              "h-1 flex-1 rounded-full",
              step <= 3 ? "bg-[var(--nm-cta)]" : "bg-[#EFE2D2]",
            )}
          />
        ))}
      </div>
      <div className="rounded-md border border-[#EBDCC8] px-2.5 py-1.5 text-[var(--nm-muted)]">
        Maria Silva
      </div>
      <div className="rounded-md border border-[#EBDCC8] px-2.5 py-1.5 text-[var(--nm-muted)]">
        (11) 98888-7777
      </div>
    </div>
  );
}

function MiniQueue() {
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-[#F6EADB] p-3 text-[12px]">
      <div className="flex items-center gap-2 font-semibold">
        <span className="inline-block origin-top motion-safe:animate-[nm-ring_1.2s_ease-in-out_infinite]">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="size-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M10.268 21a2 2 0 0 0 3.464 0" />
            <path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326" />
          </svg>
        </span>
        Novos
        <span className="rounded-full bg-white px-1.5 text-[10px]">1</span>
      </div>
      <div className="rounded-lg bg-white p-2.5 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="font-bold">#0152</span>
          <span className="text-[10px] text-[var(--nm-muted)]">19:42</span>
        </div>
        <div className="mt-1 text-[11px] text-[var(--nm-muted)]">
          Delivery · Maria Silva
        </div>
        <div className="mt-2 rounded-md bg-[var(--nm-cta)] py-1.5 text-center text-[11px] font-semibold text-white">
          Aceitar e imprimir
        </div>
      </div>
    </div>
  );
}

function MiniTracking() {
  const steps = [
    ["Recebido", "done"],
    ["Em preparo", "current"],
    ["Saiu para entrega", "next"],
  ] as const;
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-[#EBDCC8] bg-white p-3 text-[12px]">
      <ol className="m-0 flex list-none flex-col gap-2 p-0">
        {steps.map(([label, state]) => (
          <li key={label} className="flex items-center gap-2">
            <span
              className={cn(
                "size-3 rounded-full",
                state === "done" && "bg-[var(--nm-cta)]",
                state === "current" &&
                  "bg-[var(--nm-cta)] ring-4 ring-[#FBEADF]",
                state === "next" && "border-2 border-[#D8C6B0]",
              )}
            />
            <span
              className={cn(
                state === "next" && "text-[var(--nm-muted)]",
                state === "current" && "font-semibold",
              )}
            >
              {label}
            </span>
          </li>
        ))}
      </ol>
      <div className="rounded-md bg-[#15803D] py-1.5 text-center text-[11px] font-semibold text-white">
        Avisar no WhatsApp
      </div>
    </div>
  );
}

/* ---------- Seções ---------- */

const JOURNEY = [
  {
    code: "01 · Cliente",
    title: "Escolhe no celular",
    text: "Abre o link da sua loja, sem baixar nada. Tamanhos, meio a meio, adicionais e observações, com o preço certo na hora.",
    mock: <MiniSizes />,
  },
  {
    code: "02 · Cliente",
    title: "Confirma em 4 passos",
    text: "Sacola, entrega ou retirada, dados e pagamento. Taxa por bairro, pedido mínimo e troco calculados sem conta de cabeça.",
    mock: <MiniSteps />,
  },
  {
    code: "03 · Cozinha",
    title: "Recebe com aviso sonoro",
    text: "O pedido aparece no painel na mesma hora. Um toque aceita e a comanda sai impressa, pronta para a cozinha.",
    mock: <MiniQueue />,
  },
  {
    code: "04 · Cliente",
    title: "Acompanha até a porta",
    text: "Cada etapa aparece no link do pedido, e você avisa o cliente pelo WhatsApp com a mensagem pronta.",
    mock: <MiniTracking />,
  },
];

function Journey() {
  return (
    <section
      id="como-funciona"
      aria-labelledby="como-funciona-titulo"
      className="relative py-20 md:py-28"
    >
      <Wrap className="flex flex-col gap-12">
        <div className="flex max-w-2xl flex-col gap-4">
          <Eyebrow>O caminho de um pedido</Eyebrow>
          <h2
            id="como-funciona-titulo"
            className={cn(
              displayFont,
              "m-0 text-[34px] leading-[1.08] tracking-[-0.02em] md:text-[46px]",
            )}
          >
            Como funciona
          </h2>
          <p className="m-0 text-[17px] leading-relaxed text-[var(--nm-muted)]">
            Quatro paradas, do primeiro toque do cliente até o pedido chegar.
            Tudo isso é o Naquela Mesa — cardápio, sacola, painel e
            acompanhamento.
          </p>
        </div>
        <ol className="relative m-0 grid list-none gap-10 p-0 lg:grid-cols-4 lg:gap-6">
          {/* Trilho do pedido: vertical no celular, horizontal no computador. */}
          <span
            aria-hidden="true"
            className="absolute top-2 bottom-2 left-[11px] border-l-2 border-dashed border-[var(--nm-line)] lg:top-[11px] lg:right-0 lg:bottom-auto lg:left-0 lg:border-t-2 lg:border-l-0"
          />
          {JOURNEY.map((station) => (
            <li
              key={station.code}
              className="relative flex flex-col gap-4 pl-10 md:grid md:grid-cols-[1fr_300px] md:items-start md:gap-8 lg:flex lg:pt-10 lg:pl-0"
            >
              <span
                aria-hidden="true"
                className="absolute top-0 left-0 grid size-6 place-items-center rounded-full border-2 border-[var(--nm-cta)] bg-[var(--nm-cream)]"
              >
                <span className="size-2 rounded-full bg-[var(--nm-cta)]" />
              </span>
              <div className="flex flex-col gap-2">
                <p className="m-0 font-mono text-[11px] tracking-[0.16em] text-[var(--nm-accent-ink)] uppercase">
                  {station.code}
                </p>
                <h3 className="m-0 text-lg font-semibold">{station.title}</h3>
                <p className="m-0 text-[15px] leading-relaxed text-[var(--nm-muted)]">
                  {station.text}
                </p>
              </div>
              <div aria-hidden="true" className="max-w-[300px]">
                {station.mock}
              </div>
            </li>
          ))}
        </ol>
      </Wrap>
    </section>
  );
}

function Swatches() {
  return (
    <div className="flex items-center gap-2">
      {["#B91C1C", "#1D4ED8", "#15803D", "#7C3AED", "#F59E0B"].map(
        (color, index) => (
          <span
            key={color}
            className={cn(
              "size-7 rounded-full ring-2 ring-[#3B2A20]",
              index === 0 && "ring-[#FBF5EC]",
            )}
            style={{ background: color }}
          />
        ),
      )}
    </div>
  );
}

function Toggle() {
  return (
    <div className="flex flex-col gap-2 text-[13px]">
      {[
        ["Calabresa", true],
        ["Frango com Catupiry", false],
      ].map(([name, on]) => (
        <div
          key={String(name)}
          className="flex items-center justify-between gap-3 rounded-lg bg-white/5 px-3 py-2"
        >
          <span className={cn(!on && "text-[#FBF5EC]/50 line-through")}>
            {name}
          </span>
          <span
            className={cn(
              "flex h-5 w-9 items-center rounded-full p-0.5",
              on
                ? "justify-end bg-[var(--nm-brand)]"
                : "justify-start bg-white/15",
            )}
          >
            <span className="size-4 rounded-full bg-white" />
          </span>
        </div>
      ))}
    </div>
  );
}

function Bars() {
  return (
    <div className="flex h-20 items-end gap-1.5">
      {[30, 45, 38, 70, 92, 100, 64].map((height, index) => (
        <span
          key={index}
          className="flex-1 rounded-t bg-[var(--nm-brand)]"
          style={{ height: `${height}%`, opacity: 0.45 + index * 0.08 }}
        />
      ))}
    </div>
  );
}

const FEATURES: {
  title: string;
  text: string;
  visual?: ReactNode;
  wide?: boolean;
  tall?: boolean;
  full?: boolean;
}[] = [
  {
    title: "Com a cara da sua loja",
    text: "Logo, capa, cores e fonte dos títulos. O cardápio é seu, não de um aplicativo.",
    visual: <Swatches />,
    wide: true,
  },
  {
    title: "Acabou? Um toque.",
    text: "Marque o que esgotou e o cardápio atualiza na hora, sem tirar o produto do ar.",
    visual: <Toggle />,
    tall: true,
  },
  {
    title: "Meio a meio e adicionais",
    text: "Borda recheada, sabores divididos por tamanho, regra de preço do meio a meio: o sistema calcula.",
  },
  {
    title: "Comanda impressa",
    text: "Ao aceitar, a comanda sai pronta para a cozinha, com itens, observações, endereço e troco.",
  },
  {
    title: "Números do seu dia",
    text: "Faturamento, ticket médio, mais vendidos e horários de pico, sem planilha.",
    visual: <Bars />,
    full: true,
  },
];

function Features() {
  return (
    <section
      id="recursos"
      aria-labelledby="recursos-titulo"
      className="bg-[var(--nm-ink)] py-20 text-[#FBF5EC] md:py-28"
    >
      <Wrap className="flex flex-col gap-12">
        <div className="flex max-w-2xl flex-col gap-4">
          <Eyebrow className="text-[#F3B48E]">Por trás do balcão</Eyebrow>
          <h2
            id="recursos-titulo"
            className={cn(
              displayFont,
              "m-0 text-[34px] leading-[1.08] tracking-[-0.02em] md:text-[46px]",
            )}
          >
            Um painel que cabe na rotina da cozinha
          </h2>
          <p className="m-0 text-[17px] leading-relaxed text-[#E9DCCB]">
            Pensado para quem atende com pressa: poucos toques, letras grandes e
            funciona no celular, no tablet ou no computador do caixa.
          </p>
        </div>
        <ul className="m-0 grid list-none gap-4 p-0 md:grid-cols-3">
          {FEATURES.map((feature) => (
            <li
              key={feature.title}
              className={cn(
                "flex flex-col justify-between gap-6 rounded-[22px] border border-white/10 bg-white/[0.04] p-6",
                feature.wide && "md:col-span-2",
                feature.tall && "md:row-span-2",
                feature.full && "md:col-span-3",
              )}
            >
              <div className="flex flex-col gap-2">
                <h3 className="m-0 text-xl font-semibold">{feature.title}</h3>
                <p className="m-0 max-w-md text-[15px] leading-relaxed text-[#E9DCCB]">
                  {feature.text}
                </p>
              </div>
              {feature.visual && <div aria-hidden="true">{feature.visual}</div>}
            </li>
          ))}
        </ul>
      </Wrap>
    </section>
  );
}

const AUDIENCE = [
  "Pizzarias",
  "Hamburguerias",
  "Lanchonetes",
  "Restaurantes de bairro",
  "Marmitarias",
  "Açaí e sorvetes",
];

function Audience() {
  return (
    <section
      aria-labelledby="para-quem-titulo"
      className="border-y border-[var(--nm-line)] py-16"
      style={gingham}
    >
      <Wrap className="flex flex-col items-center gap-6 text-center">
        <h2
          id="para-quem-titulo"
          className={cn(
            displayFont,
            "m-0 text-[28px] leading-tight md:text-[34px]",
          )}
        >
          Feito para a mesa de quem cozinha
        </h2>
        <ul className="m-0 flex list-none flex-wrap justify-center gap-2.5 p-0">
          {AUDIENCE.map((kind) => (
            <li
              key={kind}
              className="rounded-full border border-[var(--nm-line)] bg-[var(--nm-card)] px-4 py-2 text-[15px] font-medium shadow-[0_6px_14px_-10px_rgba(59,42,32,0.5)]"
            >
              {kind}
            </li>
          ))}
        </ul>
        <p className="m-0 max-w-xl text-[15px] leading-relaxed text-[var(--nm-muted)]">
          Sua loja já começa com um cardápio modelo de pizzaria, hamburgueria ou
          lanchonete. É só ajustar os preços e abrir.
        </p>
      </Wrap>
    </section>
  );
}

export default function HomePage() {
  return (
    <div
      style={brandThemeStyle}
      className={cn(
        brandFonts,
        "min-h-dvh w-full overflow-x-clip bg-[var(--nm-cream)] font-sans text-[var(--nm-ink)]",
      )}
    >
      <header className="relative z-10">
        <Wrap className="flex h-16 items-center justify-between gap-4 sm:h-20">
          <Link
            href="/"
            className={cn(
              scriptFont,
              "flex shrink-0 items-center gap-2 text-[22px] whitespace-nowrap text-[var(--nm-brand)] sm:gap-2.5 sm:text-[26px]",
            )}
          >
            <BrandLogo
              id="header"
              size={40}
              color={BRAND_COLOR}
              className="size-[34px] sm:size-10"
            />
            Naquela Mesa
          </Link>
          <nav
            aria-label="Principal"
            className="flex items-center gap-1 sm:gap-2"
          >
            <a
              href="#como-funciona"
              className="hidden rounded-full px-3 py-2 text-sm hover:bg-[var(--nm-sand)] md:inline-block"
            >
              Como funciona
            </a>
            <a
              href="#recursos"
              className="hidden rounded-full px-3 py-2 text-sm hover:bg-[var(--nm-sand)] md:inline-block"
            >
              Recursos
            </a>
            <Link
              href="/login"
              className="rounded-full px-3 py-2 text-sm font-medium hover:bg-[var(--nm-sand)]"
            >
              Entrar
            </Link>
            <a
              href={CONTACT_HREF}
              aria-label="Entrar em contato"
              className={cn(button, primary, "h-10 px-4 text-sm")}
            >
              <span className="sm:hidden">Contato</span>
              <span className="hidden sm:inline">Entrar em contato</span>
            </a>
          </nav>
        </Wrap>
      </header>

      <main>
        <section
          aria-labelledby="hero-titulo"
          className="relative pt-8 pb-20 md:pt-14 md:pb-28"
        >
          {/* Toalha xadrez atrás da ilustração, só no computador. */}
          <div
            aria-hidden="true"
            className="absolute inset-y-0 right-0 hidden w-[42%] rounded-bl-[64px] md:block"
            style={gingham}
          />
          <Wrap className="relative grid items-center gap-14 md:grid-cols-[1.05fr_1fr] md:gap-8">
            <div className="flex flex-col gap-7">
              <Eyebrow>Cardápio digital · Pedidos · Comanda</Eyebrow>
              <h1
                id="hero-titulo"
                className={cn(
                  displayFont,
                  "m-0 text-[40px] leading-[1.02] tracking-[-0.025em] sm:text-[52px] lg:text-[64px]",
                )}
              >
                Do celular do cliente{" "}
                <span className="text-[var(--nm-cta)] italic">direto</span> para
                a comanda da cozinha.
              </h1>
              <p className="m-0 max-w-[34rem] text-[17px] leading-[1.65] text-[var(--nm-muted)] sm:text-lg">
                O Naquela Mesa junta cardápio digital, sacola, painel de pedidos
                e comanda impressa num só lugar. O cliente pede pelo link da sua
                loja, sem baixar aplicativo; sua equipe recebe, prepara e avisa
                pelo WhatsApp.
              </p>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                <a href={CONTACT_HREF} className={cn(button, primary)}>
                  Entrar em contato
                </a>
                <Link
                  href="/login"
                  className={cn("text-[15px] font-medium", quiet)}
                >
                  Já tenho loja: entrar
                </Link>
              </div>
            </div>

            <div
              aria-hidden="true"
              className="relative mx-auto h-[540px] w-full max-w-[460px]"
            >
              <div className="absolute top-0 left-0 sm:left-4">
                <PhoneMenu />
              </div>
              {/* Seta tracejada: o pedido sai do celular e vira comanda. */}
              <svg
                viewBox="0 0 120 80"
                className="absolute top-[150px] left-[190px] hidden w-[110px] text-[var(--nm-cta)] sm:block"
                fill="none"
              >
                <path
                  d="M4 10 C 50 0, 90 20, 104 64"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeDasharray="5 6"
                  strokeLinecap="round"
                />
                <path
                  d="M96 58 L105 67 L110 55"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <div className="absolute right-0 bottom-0">
                <div className="mx-auto mb-[-6px] h-3 w-[244px] rounded-t-md bg-[var(--nm-ink)]" />
                <Receipt animated />
              </div>
            </div>
          </Wrap>
        </section>

        <Journey />
        <Features />
        <Audience />

        <section
          id="contato"
          aria-labelledby="contato-titulo"
          className="py-20 md:py-28"
        >
          <Wrap>
            <div className="relative flex flex-col items-center gap-6 overflow-hidden rounded-[32px] bg-[var(--nm-cta)] px-6 py-14 text-center text-white md:py-20">
              <div
                aria-hidden="true"
                className="absolute inset-0 opacity-60"
                style={gingham}
              />
              <BrandLogo
                id="cta"
                size={84}
                color="#FBF5EC"
                label="Logo Naquela Mesa"
                className="relative [&_path]:fill-[var(--nm-cta)]"
              />
              <h2
                id="contato-titulo"
                className={cn(
                  displayFont,
                  "relative m-0 text-[34px] leading-tight tracking-[-0.02em] md:text-[48px]",
                )}
              >
                Vamos abrir a sua mesa?
              </h2>
              <p className="relative m-0 max-w-xl text-[17px] leading-relaxed text-white/90">
                Conte como funciona o seu restaurante e a gente prepara a sua
                loja com o cardápio modelo. Você ajusta os preços e começa a
                vender.
              </p>
              <a
                href={CONTACT_HREF}
                className={cn(
                  button,
                  "relative bg-[#FBF5EC] text-[var(--nm-ink)] hover:bg-white",
                )}
              >
                Entrar em contato
              </a>
            </div>
          </Wrap>
        </section>
      </main>

      <footer className="border-t border-[var(--nm-line)]">
        <Wrap className="flex flex-col items-start gap-4 py-8 text-[13px] text-[var(--nm-muted)] sm:flex-row sm:items-center sm:justify-between">
          <span>
            <span
              className={cn(scriptFont, "text-[18px] text-[var(--nm-brand)]")}
            >
              Naquela Mesa
            </span>{" "}
            · cardápio digital e gestão de pedidos
          </span>
          <div className="flex gap-5">
            <Link href="/privacidade" className="hover:text-[var(--nm-cta)]">
              Privacidade
            </Link>
            <Link href="/login" className="hover:text-[var(--nm-cta)]">
              Entrar
            </Link>
          </div>
        </Wrap>
      </footer>
    </div>
  );
}
