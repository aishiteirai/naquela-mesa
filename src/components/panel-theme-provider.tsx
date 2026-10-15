"use client";

import { ThemeProvider } from "next-themes";
import { useEffect, type ReactNode } from "react";

// Modo claro/escuro só no painel e no admin. O next-themes marca o <html> com a classe do tema;
// ao sair dessas áreas pelo cliente (ex.: "Sair" → /login), a marca é removida para o resto do app ficar claro.
export function PanelThemeProvider({ children }: { children: ReactNode }) {
  useEffect(
    () => () => {
      const root = document.documentElement;
      root.classList.remove("light", "dark");
      root.style.colorScheme = "";
    },
    [],
  );

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
    </ThemeProvider>
  );
}
