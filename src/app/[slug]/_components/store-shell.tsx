import type { CSSProperties, ReactNode } from "react";
import { themeCssVariables, type Store } from "@/modules/stores";
import { StoreThemeProvider } from "@/components/store-theme-provider";
import { StoreThemeRoot } from "./store-theme-root";

export function StoreShell({ theme, children }: { theme: Store["theme"]; children: ReactNode }) {
  const vars = themeCssVariables(theme);
  return (
    <StoreThemeProvider>
      <div data-store-theme="" style={vars as CSSProperties} className="flex flex-1 flex-col bg-background">
        <StoreThemeRoot vars={vars} />
        {children}
      </div>
    </StoreThemeProvider>
  );
}
