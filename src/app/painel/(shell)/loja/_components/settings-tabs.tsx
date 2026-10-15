"use client";

import { useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { parseSettingsTab, SETTINGS_TABS, type SettingsTab } from "@/app/painel/_lib/settings-tab";

function selectTab(tab: string) {
  const url = new URL(window.location.href);
  url.searchParams.set("aba", tab);
  window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
}

/** Abas controladas por ?aba=. As abas inativas continuam montadas (escondidas) para não perder o que foi digitado. */
export function SettingsTabs({ panels }: { panels: Record<SettingsTab, ReactNode> }) {
  const tab = parseSettingsTab(useSearchParams().get("aba"));

  return (
    <Tabs value={tab} onValueChange={selectTab} className="gap-6">
      <TabsList className="w-full sm:w-fit">
        {SETTINGS_TABS.map(([value, label]) => (
          <TabsTrigger key={value} value={value}>
            {label}
          </TabsTrigger>
        ))}
      </TabsList>
      {SETTINGS_TABS.map(([value]) => (
        <TabsContent key={value} value={value} forceMount className="flex flex-col gap-6 data-[state=inactive]:hidden">
          {panels[value]}
        </TabsContent>
      ))}
    </Tabs>
  );
}
