export type Cents = number;

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function assertCents(value: number): asserts value is Cents {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`Valor em centavos inválido: ${value}`);
  }
}

export function formatBRL(cents: Cents): string {
  assertCents(cents);
  return brl.format((cents + 0) / 100);
}

// "1.234,56", "34,9", "R$ 12" — vírgula decimal (até 2 casas), ponto só como separador de milhar.
const BRL_INPUT = /^(?:R\$\s*)?(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?$/;

export function parseBRLToCents(input: string): Cents | null {
  const match = BRL_INPUT.exec(input.trim());
  if (!match) return null;
  const reais = Number(match[1]!.replaceAll(".", ""));
  const centavos = Number((match[2] ?? "").padEnd(2, "0"));
  const cents = reais * 100 + centavos;
  return Number.isSafeInteger(cents) ? cents : null;
}

export function formatCentsForInput(cents: Cents): string {
  assertCents(cents);
  return `${Math.floor(cents / 100)},${String(cents % 100).padStart(2, "0")}`;
}
