import type { ActionState } from "@/app/_lib/action-state";

/** Erros do schema por índice (`sizePrices.0.priceCents`) passam a apontar para o campo do tamanho (`price:<id>`). */
export function mapSizePriceErrors(state: ActionState, sizePrices: { sizeId: string }[]): ActionState {
  if (state.status !== "error") return state;
  const fieldErrors: Record<string, string> = {};
  for (const [key, message] of Object.entries(state.fieldErrors)) {
    const match = /^sizePrices\.(\d+)/.exec(key);
    const sizeId = match ? sizePrices[Number(match[1])]?.sizeId : undefined;
    fieldErrors[sizeId ? `price:${sizeId}` : key] = message;
  }
  return { ...state, fieldErrors };
}
