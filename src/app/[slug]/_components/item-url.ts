"use client";

import { ITEM_PARAM } from "@/app/[slug]/_lib/item-param";

// true quando a entrada atual do histórico foi criada por openItem: fechar volta uma entrada
// (o mesmo que o botão voltar do celular). Aberto por link direto, fechar só limpa o parâmetro.
let pushedByMenu = false;

// Voltar do navegador/Android consome a entrada criada por openItem: sem isto a flag fica velha e um fechar posterior sairia da página.
if (typeof window !== "undefined") {
  window.addEventListener("popstate", () => {
    pushedByMenu = false;
  });
}

function urlWithItem(productId: string | null): string {
  const url = new URL(window.location.href);
  if (productId) url.searchParams.set(ITEM_PARAM, productId);
  else url.searchParams.delete(ITEM_PARAM);
  return `${url.pathname}${url.search}${url.hash}`;
}

export function openItem(productId: string): void {
  if (new URL(window.location.href).searchParams.get(ITEM_PARAM) === productId) return;
  pushedByMenu = true;
  window.history.pushState(null, "", urlWithItem(productId));
}

export function closeItem(): void {
  if (pushedByMenu) {
    pushedByMenu = false;
    window.history.back();
    return;
  }
  window.history.replaceState(null, "", urlWithItem(null));
}
