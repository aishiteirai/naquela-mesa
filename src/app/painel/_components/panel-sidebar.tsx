"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ChartColumnIcon,
  ClipboardListIcon,
  ExternalLinkIcon,
  HistoryIcon,
  ListPlusIcon,
  LogOutIcon,
  SettingsIcon,
  UtensilsCrossedIcon,
  type LucideIcon,
} from "lucide-react";
import { ModeToggle } from "@/components/mode-toggle";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { authClient } from "@/modules/auth/client";
import { isNavItemActive, PANEL_NAV } from "@/app/painel/_lib/nav";

const ICONS: Record<string, LucideIcon> = {
  "/painel": ClipboardListIcon,
  "/painel/pedidos": HistoryIcon,
  "/painel/metricas": ChartColumnIcon,
  "/painel/cardapio": UtensilsCrossedIcon,
  "/painel/cardapio/adicionais": ListPlusIcon,
  "/painel/loja": SettingsIcon,
};

type Props = { storeName: string; storeSlug: string; logoUrl: string | null };

export function PanelSidebar({ storeName, storeSlug, logoUrl }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const { isMobile, setOpenMobile } = useSidebar();

  // Na gaveta do celular, navegar fecha o menu.
  function closeOnMobile() {
    if (isMobile) setOpenMobile(false);
  }

  async function signOut() {
    await authClient.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <Sidebar collapsible="icon" className="print:hidden">
      <SidebarHeader>
        <div className="flex items-center gap-2 p-1">
          {logoUrl ? (
            <Image src={logoUrl} alt="" width={32} height={32} unoptimized className="size-8 shrink-0 rounded-md object-cover" />
          ) : (
            <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-md bg-sidebar-primary font-semibold text-sidebar-primary-foreground">
              {storeName.charAt(0).toUpperCase()}
            </span>
          )}
          <span className="truncate font-semibold group-data-[collapsible=icon]:hidden">{storeName}</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <nav aria-label="Painel">
          {PANEL_NAV.map((group) => (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map((item) => {
                    const Icon = ICONS[item.href];
                    const active = isNavItemActive(pathname, item.href);
                    return (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
                          <Link href={item.href} aria-current={active ? "page" : undefined} onClick={closeOnMobile}>
                            {Icon && <Icon />}
                            <span>{item.label}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="Ver cardápio">
                    <a href={`/${storeSlug}`} target="_blank" rel="noreferrer">
                      <ExternalLinkIcon />
                      <span>Ver cardápio</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </nav>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem className="flex items-center gap-2 group-data-[collapsible=icon]:flex-col">
            <ModeToggle />
            <SidebarMenuButton onClick={signOut} tooltip="Sair" className="flex-1">
              <LogOutIcon />
              <span>Sair</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
