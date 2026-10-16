import { MAX_ITEM_QUANTITY, type CartItemInput } from "@/modules/orders/client";

export type CartLine = { key: string; input: CartItemInput; label: string; unitPriceCents: number };

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isCartItemInput(value: unknown): value is CartItemInput {
  if (typeof value !== "object" || value === null) return false;
  const input = value as Record<string, unknown>;
  if (!isStringArray(input.optionIds)) return false;
  if (!Number.isInteger(input.quantity) || (input.quantity as number) < 1 || (input.quantity as number) > MAX_ITEM_QUANTITY) return false;
  if (input.notes !== null && typeof input.notes !== "string") return false;
  if (input.kind === "simple") return typeof input.productId === "string";
  if (input.kind === "sized") return typeof input.sizeId === "string" && isStringArray(input.flavorIds);
  return false;
}

export function isCartLine(value: unknown): value is CartLine {
  if (typeof value !== "object" || value === null) return false;
  const line = value as Record<string, unknown>;
  return (
    typeof line.key === "string" &&
    typeof line.label === "string" &&
    Number.isSafeInteger(line.unitPriceCents) &&
    (line.unitPriceCents as number) >= 0 &&
    isCartItemInput(line.input)
  );
}

export function parseStoredCart(raw: string | null): CartLine[] {
  if (raw === null) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isCartLine) : [];
  } catch {
    return [];
  }
}

// Mesmo produto, tamanho, sabores, adicionais e observação: é o mesmo item (só muda a quantidade).
function sameItem(a: CartItemInput, b: CartItemInput): boolean {
  return JSON.stringify({ ...a, quantity: 0 }) === JSON.stringify({ ...b, quantity: 0 });
}

/** Adiciona um item à sacola; se já existe uma linha igual, soma a quantidade (até o máximo por item). */
export function addCartLine(lines: CartLine[], line: CartLine): CartLine[] {
  const existing = lines.find((current) => sameItem(current.input, line.input));
  if (!existing) return [...lines, line];
  const quantity = Math.min(existing.input.quantity + line.input.quantity, MAX_ITEM_QUANTITY);
  return lines.map((current) =>
    current === existing ? { ...current, unitPriceCents: line.unitPriceCents, input: { ...current.input, quantity } } : current,
  );
}
