"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChartColumnIcon, ClipboardListIcon, HistoryIcon, UtensilsCrossedIcon, type LucideIcon } from "lucide-react";
import { ModeToggle } from "@/components/mode-toggle";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { scriptFont } from "@/app/_components/brand-theme";
import { NewOrdersBadge } from "@/app/painel/_components/new-orders-badge";
import { StoreMenu } from "@/app/painel/_components/store-menu";
import { isNavItemActive, PANEL_NAV, type NavItem } from "@/app/painel/_lib/nav";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  "/painel": ClipboardListIcon,
  "/painel/cardapio": UtensilsCrossedIcon,
  "/painel/pedidos": HistoryIcon,
  "/painel/metricas": ChartColumnIcon,
};

// Pedidos é o item principal: 44px, sempre realçado (card quando inativo, primária quando ativo).
const PRIMARY_ITEM =
  "relative h-11 rounded-[10px] bg-card text-[15px] font-semibold text-card-foreground hover:bg-card hover:text-card-foreground active:bg-card active:text-card-foreground data-active:bg-primary data-active:text-primary-foreground data-active:hover:bg-primary-hover data-active:hover:text-primary-foreground data-active:active:bg-primary-hover data-active:active:text-primary-foreground group-data-[collapsible=icon]:size-10! group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0! [&_svg]:size-[18px]";
const SECONDARY_ITEM = "h-9 data-active:font-semibold";

type Props = { storeName: string; storeSlug: string; logoUrl: string | null; statusText: string; isOpen: boolean };

export function PanelSidebar({ storeName, storeSlug, logoUrl, statusText, isOpen }: Props) {
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();

  // Na gaveta do celular, navegar fecha o menu.
  function closeOnMobile() {
    if (isMobile) setOpenMobile(false);
  }

  function renderItem(item: NavItem) {
    const Icon = ICONS[item.href] ?? ClipboardListIcon;
    const active = isNavItemActive(pathname, item.href);
    return (
      <SidebarMenuItem key={item.href}>
        <SidebarMenuButton asChild isActive={active} tooltip={item.label} className={item.primary ? PRIMARY_ITEM : SECONDARY_ITEM}>
          <Link href={item.href} aria-current={active ? "page" : undefined} onClick={closeOnMobile}>
            <Icon />
            <span className={item.primary ? "flex-1 group-data-[collapsible=icon]:hidden" : undefined}>{item.label}</span>
            {item.primary && <NewOrdersBadge active={active} />}
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }

  return (
    <Sidebar collapsible="icon" className="print:hidden">
      <SidebarHeader>
        <StoreMenu storeName={storeName} storeSlug={storeSlug} logoUrl={logoUrl} statusText={statusText} isOpen={isOpen} />
      </SidebarHeader>
      <SidebarContent>
        <nav aria-label="Painel">
          <SidebarGroup className="pt-3">
            <SidebarMenu>{PANEL_NAV.filter((item) => item.primary).map(renderItem)}</SidebarMenu>
          </SidebarGroup>
          <SidebarSeparator className="mx-3" />
          <SidebarGroup>
            <SidebarMenu>{PANEL_NAV.filter((item) => !item.primary).map(renderItem)}</SidebarMenu>
          </SidebarGroup>
        </nav>
      </SidebarContent>
      <SidebarFooter>
        <SidebarSeparator className="mx-1" />
        <div className="flex items-center justify-between gap-2 px-2 py-1 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:px-0">
          <Link href="/" className="flex flex-col text-[11px] leading-tight text-muted-foreground group-data-[collapsible=icon]:hidden">
            Painel por
            <span className={cn(scriptFont, "text-xl leading-snug text-brand")}>Naquela Mesa</span>
          </Link>
          <ModeToggle className="size-8" />
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

/** Botão de recolher (desktop) ou abrir (celular) a barra lateral, no topo do conteúdo. */
export function PanelSidebarToggle() {
  const { isMobile } = useSidebar();
  return <SidebarTrigger aria-label={isMobile ? "Abrir menu" : "Recolher barra lateral"} className="-ml-1" />;
}
