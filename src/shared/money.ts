export type Cents = number;

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function assertCents(value: number): asserts value is Cents {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`Valor em centavos inválido: ${value}`);
  }
}

export function formatBRL(cents: Cents): string {
  assertCents(cents);
  return brl.format(cents / 100);
}
