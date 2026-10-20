import { priceItem, type PricingContext } from "@/modules/orders/client";
import { isDomainError } from "@/shared/errors";
import type { CartLine } from "@/app/[slug]/_components/cart-storage";

export type RepricedLine = { line: CartLine; totalCents: number | null; problem: string | null };

const PROBLEMS: Record<string, string> = {
  ITEM_UNAVAILABLE: "não está mais disponível",
  INVALID_OPTIONS: "mudou no cardápio",
};

/** Recalcula a sacola com o cardápio atual: preço de agora por linha, ou por que não dá mais para pedir. */
export function repriceCart(ctx: PricingContext, lines: CartLine[]): { lines: RepricedLine[]; subtotalCents: number; hasProblems: boolean } {
  const repriced = lines.map((line, index): RepricedLine => {
    try {
      return { line, totalCents: priceItem(ctx, line.input, index).totalCents, problem: null };
    } catch (error) {
      if (!isDomainError(error)) throw error;
      return { line, totalCents: null, problem: PROBLEMS[error.code] ?? "mudou no cardápio" };
    }
  });
  return {
    lines: repriced,
    subtotalCents: repriced.reduce((sum, item) => sum + (item.totalCents ?? 0), 0),
    hasProblems: repriced.some((item) => item.problem !== null),
  };
}
