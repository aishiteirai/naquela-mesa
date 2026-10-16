"use client";

/**
 * Painel/modal controlado por parâmetros da URL (?item=, ?produto=/?novo=).
 * Abrir empilha uma entrada no histórico (o voltar do navegador fecha); aberto por link direto,
 * fechar só limpa os parâmetros. `clearKeys` são os parâmetros que o fechar remove.
 */
export function patchedUrl(patch: Record<string, string | null>): string {
  const url = new URL(window.location.href);
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) url.searchParams.delete(key);
    else url.searchParams.set(key, value);
  }
  return `${url.pathname}${url.search}${url.hash}`;
}

/** Troca parâmetros sem nova entrada no histórico. */
export function replaceParams(patch: Record<string, string | null>): void {
  window.history.replaceState(null, "", patchedUrl(patch));
}

export function createUrlOverlay(clearKeys: readonly string[]) {
  // true quando a entrada atual do histórico foi criada por open: fechar volta uma entrada.
  let pushedByOverlay = false;

  // Voltar do navegador/Android consome a entrada criada por open: sem isto a flag fica velha e um fechar posterior sairia da página.
  if (typeof window !== "undefined") {
    window.addEventListener("popstate", () => {
      pushedByOverlay = false;
    });
  }

  return {
    /** `idempotent`: não empilha de novo se a URL já tem todos os parâmetros do patch. */
    open(patch: Record<string, string | null>, options: { idempotent?: boolean } = {}): void {
      if (options.idempotent) {
        const params = new URL(window.location.href).searchParams;
        if (Object.entries(patch).every(([key, value]) => params.get(key) === value)) return;
      }
      pushedByOverlay = true;
      window.history.pushState(null, "", patchedUrl(patch));
    },
    close(): void {
      if (pushedByOverlay) {
        pushedByOverlay = false;
        window.history.back();
        return;
      }
      replaceParams(Object.fromEntries(clearKeys.map((key) => [key, null])));
    },
  };
}
