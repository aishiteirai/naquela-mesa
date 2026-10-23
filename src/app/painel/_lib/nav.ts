export type NavItem = { href: string; label: string; primary?: true };

export const PANEL_NAV: NavItem[] = [
  { href: "/painel", label: "Pedidos", primary: true },
  { href: "/painel/cardapio", label: "Cardápio" },
  { href: "/painel/pedidos", label: "Histórico" },
  { href: "/painel/metricas", label: "Métricas" },
];

/** `/painel` só vale na raiz; os demais valem no próprio caminho e em qualquer subcaminho. */
export function isNavItemActive(pathname: string, href: string): boolean {
  if (href === "/painel") return pathname === "/painel";
  return pathname === href || pathname.startsWith(`${href}/`);
}

const TRAILS: { href: string; trail: string[] }[] = [
  { href: "/painel/loja", trail: ["Loja", "Configurações"] },
  { href: "/painel/cardapio/adicionais", trail: ["Cardápio", "Adicionais"] },
  { href: "/painel/cardapio", trail: ["Cardápio"] },
  { href: "/painel/pedidos", trail: ["Operação", "Histórico"] },
  { href: "/painel/metricas", trail: ["Operação", "Métricas"] },
  { href: "/painel", trail: ["Operação", "Pedidos"] },
];

/** Trilha do topo do conteúdo para o caminho atual (vazia fora do mapa). */
export function pageTrail(pathname: string): string[] {
  return TRAILS.find(({ href }) => isNavItemActive(pathname, href))?.trail ?? [];
}
