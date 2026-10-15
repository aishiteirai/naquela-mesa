import { cookies } from "next/headers";
import { Suspense, type ReactNode } from "react";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PanelSidebar } from "@/app/painel/_components/panel-sidebar";
import { PageTitle } from "@/app/painel/_components/page-title";
import { SupportBanner } from "@/app/painel/_components/support-banner";
import { requireStoreAccess } from "@/app/painel/_lib/access";

// Mesmo cookie que o SidebarProvider grava ao recolher/abrir no desktop.
const SIDEBAR_COOKIE = "sidebar_state";

async function Shell({ children }: { children: ReactNode }) {
  const [{ store, user }, cookieStore] = await Promise.all([requireStoreAccess(), cookies()]);

  return (
    <TooltipProvider>
    <SidebarProvider defaultOpen={cookieStore.get(SIDEBAR_COOKIE)?.value !== "false"}>
      <PanelSidebar storeName={store.name} storeSlug={store.slug} logoUrl={store.logoUrl} />
      <SidebarInset>
        {user.impersonatedBy && <SupportBanner storeName={store.name} />}
        <div className="sticky top-0 z-10 flex h-14 items-center gap-2 border-b bg-background px-4">
          <SidebarTrigger aria-label="Abrir menu" className="-ml-1" />
          <Separator orientation="vertical" className="mr-1 data-vertical:h-4 data-vertical:self-center" />
          <PageTitle />
        </div>
        <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
    </TooltipProvider>
  );
}

export default function ShellLayout({ children }: LayoutProps<"/painel">) {
  return (
    <Suspense fallback={<div className="min-h-svh" />}>
      <Shell>{children}</Shell>
    </Suspense>
  );
}
