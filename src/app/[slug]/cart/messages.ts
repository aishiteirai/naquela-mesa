import type { OrderQuote } from "@/modules/orders";
import type { DomainError } from "@/shared/errors";
import { formatBRL } from "@/shared/money";

export type CheckoutError = { code: string; message: string; fieldErrors: Record<string, string>; quote?: OrderQuote };

function plain(code: string, message: string): CheckoutError {
  return { code, message, fieldErrors: {} };
}

export function toCheckoutError(error: DomainError): CheckoutError {
  const details = error.details;
  switch (error.code) {
    case "STORE_CLOSED":
      return plain(error.code, `A loja está fechada agora. ${String(details.message ?? "")}`.trim());
    case "ITEM_UNAVAILABLE":
      return plain(
        error.code,
        `O item ${Number(details.itemIndex ?? 0) + 1} da sacola não está mais disponível (${String(details.name ?? "item")}). Volte à sacola para remover.`,
      );
    case "INVALID_OPTIONS":
      return plain(error.code, `Revise o item ${Number(details.itemIndex ?? 0) + 1} da sacola: ${String(details.reason ?? "opções inválidas")}.`);
    case "BELOW_MIN_ORDER":
      return plain(error.code, `Pedido mínimo de ${formatBRL(Number(details.minOrderCents ?? 0))} (sem a entrega).`);
    case "ZONE_NOT_SERVED":
      return plain(error.code, "Ainda não entregamos nesse bairro. Que tal retirar no balcão?");
    case "FULFILLMENT_DISABLED":
      return plain(error.code, "Esse tipo de pedido não está disponível agora. Escolha outra opção.");
    case "PAYMENT_DISABLED":
      return plain(error.code, "Essa forma de pagamento não está disponível. Escolha outra.");
    case "PRICE_CHANGED":
      return {
        ...plain(error.code, "Os preços mudaram desde a revisão. Confira o novo total e confirme de novo."),
        quote: details.quote as OrderQuote,
      };
    case "RATE_LIMITED":
      return plain(error.code, "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente de novo.");
    case "NOT_FOUND":
      return plain(error.code, "Loja não encontrada.");
    case "VALIDATION": {
      const issues = (details.issues ?? []) as { path: string; message: string }[];
      return {
        code: error.code,
        message: "Confira os campos destacados.",
        fieldErrors: Object.fromEntries(issues.map((issue) => [issue.path || "_", issue.message])),
      };
    }
    default:
      return plain(error.code, "Não foi possível enviar o pedido. Tente de novo.");
  }
}
