import { cookies } from "next/headers";
import { connection } from "next/server";
import { Suspense, type ReactNode } from "react";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { NewOrdersProvider } from "@/app/painel/_components/new-orders-context";
import { PanelSidebar, PanelSidebarToggle } from "@/app/painel/_components/panel-sidebar";
import { PageTitle } from "@/app/painel/_components/page-title";
import { SupportBanner } from "@/app/painel/_components/support-banner";
import { PanelThemeRoot } from "@/app/painel/_components/panel-theme-root";
import { requireStoreAccess } from "@/app/painel/_lib/access";
import { panelThemeVariables } from "@/app/painel/_lib/panel-theme";
import { getQueueVersion } from "@/modules/orders";
import { formatStoreStatus, getOpenStatus } from "@/modules/stores";

// Mesmo cookie que o SidebarProvider grava ao recolher/abrir no desktop.
const SIDEBAR_COOKIE = "sidebar_state";

async function Shell({ children }: { children: ReactNode }) {
  const [{ store, user }, cookieStore] = await Promise.all([requireStoreAccess(), cookies()]);
  // O status depende da hora atual: precisa ser calculado a cada requisição.
  await connection();
  const [{ received }, openStatus] = await Promise.all([
    getQueueVersion(store.id),
    getOpenStatus({
      hours: store.hours,
      manualStatus: store.manualStatus,
      timeZone: store.timezone,
      now: new Date(),
    }),
  ]);

  return (
    <PanelThemeRoot
      palette={store.theme.panelColors === "store" ? "loja" : "naquela"}
      storeStyle={panelThemeVariables({ ...store.theme, panelColors: "store" })}
    >
      <TooltipProvider>
        <SidebarProvider defaultOpen={cookieStore.get(SIDEBAR_COOKIE)?.value !== "false"}>
          <NewOrdersProvider initialCount={received}>
            <PanelSidebar
              storeName={store.name}
              storeSlug={store.slug}
              logoUrl={store.logoUrl}
              statusText={formatStoreStatus(openStatus, store.manualStatus)}
              isOpen={openStatus.isOpen}
            />
            <SidebarInset>
              {user.impersonatedBy && <SupportBanner storeName={store.name} />}
              <div className="sticky top-0 z-10 flex h-14 items-center gap-2 border-b bg-background px-4">
                <PanelSidebarToggle />
                <Separator orientation="vertical" className="mr-1 data-vertical:h-4 data-vertical:self-center" />
                <PageTitle />
              </div>
              <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">{children}</div>
            </SidebarInset>
          </NewOrdersProvider>
        </SidebarProvider>
      </TooltipProvider>
    </PanelThemeRoot>
  );
}

export default function ShellLayout({ children }: LayoutProps<"/painel">) {
  return (
    <Suspense fallback={<div className="min-h-svh" />}>
      <Shell>{children}</Shell>
    </Suspense>
  );
}
