"use client";

// Painel lateral do produto controlado pela URL (?produto= / ?novo=), como o ?item= do cardápio público:
// abrir empilha uma entrada no histórico (o voltar do navegador fecha); aberto por link direto, fechar só limpa.
let pushedByEditor = false;

if (typeof window !== "undefined") {
  window.addEventListener("popstate", () => {
    pushedByEditor = false;
  });
}

const PANEL_KEYS = ["produto", "novo"] as const;

function urlWith(patch: Record<string, string | null>): string {
  const url = new URL(window.location.href);
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) url.searchParams.delete(key);
    else url.searchParams.set(key, value);
  }
  return `${url.pathname}${url.search}${url.hash}`;
}

/** Troca a categoria selecionada sem nova entrada no histórico. */
export function selectCategory(categoryId: string): void {
  window.history.replaceState(null, "", urlWith({ categoria: categoryId }));
}

export function openProduct(productId: string): void {
  pushedByEditor = true;
  window.history.pushState(null, "", urlWith({ produto: productId, novo: null }));
}

export function openNewProduct(categoryId: string): void {
  pushedByEditor = true;
  window.history.pushState(null, "", urlWith({ categoria: categoryId, novo: categoryId, produto: null }));
}

export function closeProductPanel(): void {
  if (pushedByEditor) {
    pushedByEditor = false;
    window.history.back();
    return;
  }
  window.history.replaceState(null, "", urlWith(Object.fromEntries(PANEL_KEYS.map((key) => [key, null]))));
}
