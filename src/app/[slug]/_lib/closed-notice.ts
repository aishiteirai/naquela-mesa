const GENERIC = "Fechado no momento";

/** Texto do aviso de loja fechada; a mensagem genérica não repete a informação. */
export function closedNotice(message: string): string {
  const base = "A loja está fechada agora.";
  return message === GENERIC ? base : `${base} ${message}`;
}
