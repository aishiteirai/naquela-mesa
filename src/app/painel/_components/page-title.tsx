"use client";

import { usePathname } from "next/navigation";
import { isNavItemActive, PANEL_NAV } from "@/app/painel/_lib/nav";

/** Seção atual no topo do conteúdo (o título da página continua no <h1> de cada tela). */
export function PageTitle() {
  const pathname = usePathname();
  const group = PANEL_NAV.find((item) => item.items.some((link) => isNavItemActive(pathname, link.href)));
  const item = group?.items.find((link) => isNavItemActive(pathname, link.href));
  if (!group || !item) return null;

  return (
    <p className="truncate text-sm text-muted-foreground">
      {group.label} <span aria-hidden="true">/</span> <span className="font-medium text-foreground">{item.label}</span>
    </p>
  );
}
