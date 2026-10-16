"use client";

import { createContext, useContext, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { pacifico } from "@/app/_components/brand-theme";
import type { PanelPalette } from "@/app/painel/_lib/panel-theme";
import { cn } from "@/lib/utils";

type PanelPaletteContext = {
  palette: PanelPalette;
  setPreview: (palette: PanelPalette | null) => void;
};

const PanelPaletteCtx = createContext<PanelPaletteContext | null>(null);

export function usePanelPalette(): PanelPaletteContext {
  const ctx = useContext(PanelPaletteCtx);
  if (!ctx) throw new Error("usePanelPalette precisa estar dentro de PanelThemeRoot");
  return ctx;
}

// `storeStyle` são as variáveis das cores da loja, sempre calculadas no servidor para a prévia
// (Task 15) alternar sem round-trip; só são aplicadas quando a paleta efetiva é "loja".
export function PanelThemeRoot({
  palette,
  storeStyle,
  children,
}: {
  palette: PanelPalette;
  storeStyle: Record<string, string>;
  children: ReactNode;
}) {
  const [preview, setPreview] = useState<PanelPalette | null>(null);
  const effective = preview ?? palette;
  const value = useMemo(() => ({ palette: effective, setPreview }), [effective]);

  return (
    <PanelPaletteCtx.Provider value={value}>
      <div
        data-panel-theme={effective}
        style={effective === "loja" ? (storeStyle as CSSProperties) : undefined}
        className={cn(pacifico.variable, "min-h-svh bg-background text-foreground")}
      >
        {children}
      </div>
    </PanelPaletteCtx.Provider>
  );
}
