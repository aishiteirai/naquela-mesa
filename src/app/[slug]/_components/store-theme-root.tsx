"use client";

import { useEffect } from "react";

// Dialog, Sheet, Select e DropdownMenu do shadcn abrem em portal no <body>, fora do wrapper da loja:
// enquanto a loja está na tela, as mesmas variáveis também valem no <html>.
export function StoreThemeRoot({ vars }: { vars: Record<string, string> }) {
  useEffect(() => {
    const root = document.documentElement;
    const entries = Object.entries(vars);
    for (const [name, value] of entries) root.style.setProperty(name, value);
    return () => {
      for (const [name] of entries) root.style.removeProperty(name);
    };
  }, [vars]);

  return null;
}
