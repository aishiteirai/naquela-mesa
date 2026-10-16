"use client";

import { ThemeProvider } from "next-themes";
import { useEffect, type ReactNode } from "react";

// Modo claro/escuro do cardápio público, escolhido pelo cliente. Começa claro (as cores das lojas foram
// pensadas para fundo claro) e guarda a escolha numa chave própria, separada da do painel.
// Ao sair da loja pelo cliente, a marca do <html> é removida para o resto do app voltar ao normal.
export function StoreThemeProvider({ children }: { children: ReactNode }) {
  useEffect(
    () => () => {
      const root = document.documentElement;
      root.classList.remove("light", "dark");
      root.style.colorScheme = "";
    },
    [],
  );

  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem storageKey="naquela-mesa:cardapio-tema" disableTransitionOnChange>
      {children}
    </ThemeProvider>
  );
}
