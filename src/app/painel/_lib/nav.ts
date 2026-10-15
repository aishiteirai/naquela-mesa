export type NavItem = { href: string; label: string };
export type NavGroup = { label: string; items: NavItem[] };

export const PANEL_NAV: NavGroup[] = [
  {
    label: "Operação",
    items: [
      { href: "/painel", label: "Pedidos" },
      { href: "/painel/pedidos", label: "Histórico" },
      { href: "/painel/metricas", label: "Métricas" },
    ],
  },
  {
    label: "Cardápio",
    items: [
      { href: "/painel/cardapio", label: "Produtos" },
      { href: "/painel/cardapio/adicionais", label: "Adicionais" },
    ],
  },
  { label: "Loja", items: [{ href: "/painel/loja", label: "Configurações" }] },
];

const ALL_HREFS = PANEL_NAV.flatMap((group) => group.items.map((item) => item.href));

function matches(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** `/painel` só vale na raiz; os demais valem no prefixo, e o item mais específico vence. */
export function isNavItemActive(pathname: string, href: string): boolean {
  if (href === "/painel") return pathname === "/painel";
  if (!matches(pathname, href)) return false;
  return !ALL_HREFS.some((other) => other !== href && other.startsWith(`${href}/`) && matches(pathname, other));
}
