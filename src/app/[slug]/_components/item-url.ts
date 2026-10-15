"use client";

import { ITEM_PARAM } from "@/app/[slug]/_lib/item-param";

// true quando a entrada atual do histórico foi criada por openItem: fechar volta uma entrada
// (o mesmo que o botão voltar do celular). Aberto por link direto, fechar só limpa o parâmetro.
let pushedByMenu = false;

function urlWithItem(productId: string | null): string {
  const url = new URL(window.location.href);
  if (productId) url.searchParams.set(ITEM_PARAM, productId);
  else url.searchParams.delete(ITEM_PARAM);
  return `${url.pathname}${url.search}${url.hash}`;
}

export function openItem(productId: string): void {
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
