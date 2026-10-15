import Link from "next/link";
import { Suspense } from "react";
import { SignOutButton } from "@/app/_components/sign-out-button";
import { ModeToggle } from "@/components/mode-toggle";
import { PanelThemeProvider } from "@/components/panel-theme-provider";
import { SupportBanner } from "./_components/support-banner";
import { requireStoreAccess } from "./_lib/access";

const links = [
  { href: "/painel", label: "Pedidos" },
  { href: "/painel/pedidos", label: "Histórico" },
  { href: "/painel/metricas", label: "Métricas" },
  { href: "/painel/cardapio", label: "Cardápio" },
  { href: "/painel/cardapio/adicionais", label: "Adicionais" },
  { href: "/painel/disponibilidade", label: "Disponibilidade" },
  { href: "/painel/loja", label: "Loja" },
];

async function PainelHeader() {
  const { store, user } = await requireStoreAccess();

  return (
    <>
      {user.impersonatedBy && <SupportBanner storeName={store.name} />}
      <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        <span className="font-semibold">{store.name}</span>
        <nav aria-label="Painel" className="flex flex-wrap gap-3 text-sm">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="underline-offset-4 hover:underline">
              {link.label}
            </Link>
          ))}
          <a href={`/${store.slug}`} target="_blank" rel="noreferrer" className="underline-offset-4 hover:underline">
            Ver cardápio
          </a>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <ModeToggle />
          <SignOutButton />
        </div>
      </div>
    </>
  );
}

export default function PainelLayout({ children }: LayoutProps<"/painel">) {
  return (
    <PanelThemeProvider>
      <div className="flex min-h-dvh flex-col">
        <header className="border-b print:hidden border-neutral-200 dark:border-neutral-800">
          <Suspense fallback={<div className="h-14" />}>
            <PainelHeader />
          </Suspense>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">{children}</main>
      </div>
    </PanelThemeProvider>
  );
}
