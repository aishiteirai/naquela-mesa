"use client";

import Image from "next/image";
import Link from "next/link";
import { ChevronsUpDownIcon, ClockIcon, CreditCardIcon, ExternalLinkIcon, LogOutIcon, PaletteIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSidebar } from "@/components/ui/sidebar";
import { useSignOut } from "@/app/_components/sign-out-button";
import { cn } from "@/lib/utils";

type Props = { storeName: string; storeSlug: string; logoUrl: string | null; statusText: string; isOpen: boolean };

/** Topo da barra lateral: identidade e status da loja, com o menu de configurações e saída. */
export function StoreMenu({ storeName, storeSlug, logoUrl, statusText, isOpen }: Props) {
  const signOut = useSignOut();
  const { isMobile, state, setOpenMobile } = useSidebar();

  function closeOnMobile() {
    if (isMobile) setOpenMobile(false);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`${storeName} — abrir menu da loja`}
          className="flex w-full items-center gap-2.5 rounded-[10px] p-1.5 text-left outline-hidden hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring data-[state=open]:bg-sidebar-accent group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
        >
          <span className="relative flex size-9 shrink-0 items-center justify-center rounded-[9px] bg-primary font-bold text-primary-foreground">
            {logoUrl ? (
              <Image src={logoUrl} alt="" width={36} height={36} unoptimized className="size-9 rounded-[9px] object-cover" />
            ) : (
              <span aria-hidden="true">{storeName.charAt(0).toUpperCase()}</span>
            )}
            <span
              aria-hidden="true"
              className={cn("absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full border-2 border-sidebar", isOpen ? "bg-green-500" : "bg-stone-400")}
            />
          </span>
          <span className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
            <b className="block truncate text-[15px]">{storeName}</b>
            <span className={cn("block truncate text-xs", isOpen ? "text-green-700 dark:text-green-400" : "text-muted-foreground")}>{statusText}</span>
          </span>
          <ChevronsUpDownIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground group-data-[collapsible=icon]:hidden" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        side={!isMobile && state === "collapsed" ? "right" : "bottom"}
        className="w-60 rounded-xl p-1.5"
      >
        <DropdownMenuLabel>Configurações da loja</DropdownMenuLabel>
        <DropdownMenuItem asChild className="h-8.5 gap-2.5 px-2">
          <Link href="/painel/loja?aba=aparencia" onClick={closeOnMobile}>
            <PaletteIcon />
            Aparência
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="h-8.5 gap-2.5 px-2">
          <Link href="/painel/loja?aba=horarios" onClick={closeOnMobile}>
            <ClockIcon />
            Horários e status
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="h-8.5 gap-2.5 px-2">
          <Link href="/painel/loja?aba=pedidos" onClick={closeOnMobile}>
            <CreditCardIcon />
            Pedidos e pagamento
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="h-8.5 gap-2.5 px-2">
          <a href={`/${storeSlug}`} target="_blank" rel="noreferrer">
            <ExternalLinkIcon />
            Ver cardápio
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem className="h-8.5 gap-2.5 px-2" onSelect={() => void signOut()}>
          <LogOutIcon />
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
