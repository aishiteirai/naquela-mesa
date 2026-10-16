export const CHECKOUT_STEPS = ["Sua sacola", "Entrega", "Seus dados", "Pagamento"] as const;

export type CheckoutStep = 1 | 2 | 3 | 4;

export function parseStepParam(value: string | null): CheckoutStep {
  const step = Number(value);
  return step === 2 || step === 3 || step === 4 ? step : 1;
}

// Caminho do erro de campo devolvido pelo servidor → etapa onde o campo está.
export function stepForField(path: string): CheckoutStep {
  const [root] = path.split(".");
  if (root === "items") return 1;
  if (root === "fulfillment" || root === "address" || root === "tableLabel") return 2;
  if (root === "customer") return 3;
  return 4;
}

export function firstErrorStep(fieldErrors: Record<string, string>): CheckoutStep | null {
  const paths = Object.keys(fieldErrors);
  if (paths.length === 0) return null;
  return Math.min(...paths.map(stepForField)) as CheckoutStep;
}

// O Select do bairro (Radix) não participa da validação nativa: a etapa 2 confere o bairro à parte.
export function deliveryStepErrors(input: { fulfillment: string; strategy: "fixed" | "by_neighborhood"; neighborhood: string }): Record<string, string> {
  if (input.fulfillment === "delivery" && input.strategy === "by_neighborhood" && !input.neighborhood.trim()) {
    return { "address.neighborhood": "escolha o bairro" };
  }
  return {};
}
