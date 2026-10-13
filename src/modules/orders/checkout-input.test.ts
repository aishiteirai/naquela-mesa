import { describe, expect, it } from "vitest";
import { checkoutInputSchema } from "./checkout-input";

const uuid = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
const valid = {
  idempotencyKey: uuid,
  items: [{ kind: "simple", productId: uuid, optionIds: [], quantity: 1, notes: "" }],
  fulfillment: "delivery",
  customer: { name: "Maria", phone: "(11) 98888-7777" },
  address: { street: "Rua A", number: "10", complement: "", neighborhood: "Centro", city: null, zipCode: "01310-100", reference: null },
  tableLabel: null,
  payment: { method: "cash", changeForCents: 10000 },
  notes: "",
  expectedTotalCents: null,
};

function issuePaths(input: unknown): string[] {
  const result = checkoutInputSchema.safeParse(input);
  return result.success ? [] : result.error.issues.map((issue) => issue.path.join("."));
}

describe("checkoutInputSchema", () => {
  it("aceita delivery válido e normaliza textos vazios e CEP", () => {
    const parsed = checkoutInputSchema.parse(valid);
    expect(parsed.address?.zipCode).toBe("01310100");
    expect(parsed.address?.complement).toBeNull();
    expect(parsed.notes).toBeNull();
    expect(parsed.items[0]?.notes).toBeNull();
  });

  it("descarta campos desconhecidos (honeypot fica fora)", () => {
    expect(checkoutInputSchema.parse({ ...valid, website: "x" })).not.toHaveProperty("website");
  });

  it.each([
    ["delivery sem endereço", { ...valid, address: null }, "address"],
    ["mesa sem número", { ...valid, fulfillment: "dine_in", address: null, tableLabel: "" }, "tableLabel"],
    ["troco com cartão", { ...valid, payment: { method: "card_on_delivery", changeForCents: 100 } }, "payment.changeForCents"],
    ["CEP inválido", { ...valid, address: { ...valid.address, zipCode: "123" } }, "address.zipCode"],
    ["sacola vazia", { ...valid, items: [] }, "items"],
    ["nome vazio", { ...valid, customer: { ...valid.customer, name: " " } }, "customer.name"],
    ["chave de idempotência inválida", { ...valid, idempotencyKey: "x" }, "idempotencyKey"],
  ])("recusa %s", (_label, input, path) => {
    expect(issuePaths(input)).toContain(path);
  });
});
