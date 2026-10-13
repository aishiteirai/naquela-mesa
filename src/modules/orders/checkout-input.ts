import { z } from "zod";
import { FULFILLMENTS, MAX_ORDER_CENTS, PAYMENT_METHODS } from "./types";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .transform((value) => value || null);

const itemNotes = optionalText(140);
const optionIds = z.array(z.uuid()).max(30);
const quantity = z.number().int();

const cartItemSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("simple"), productId: z.uuid(), optionIds, quantity, notes: itemNotes }),
  z.object({ kind: z.literal("sized"), sizeId: z.uuid(), flavorIds: z.array(z.uuid()).min(1).max(2), optionIds, quantity, notes: itemNotes }),
]);

const addressSchema = z.object({
  street: z.string().trim().min(1, "informe a rua").max(120),
  number: z.string().trim().min(1, "informe o número").max(20),
  complement: optionalText(60),
  neighborhood: z.string().trim().min(1, "informe o bairro").max(80),
  city: optionalText(80),
  zipCode: z
    .string()
    .trim()
    .nullable()
    .transform((value) => (value ? value.replace(/\D/g, "") || null : null))
    .refine((value) => value === null || value.length === 8, "CEP inválido"),
  reference: optionalText(120),
});

export const checkoutInputSchema = z
  .object({
    idempotencyKey: z.uuid(),
    items: z.array(cartItemSchema).min(1, "sua sacola está vazia").max(50, "itens demais na sacola"),
    fulfillment: z.enum(FULFILLMENTS),
    customer: z.object({
      name: z.string().trim().min(1, "informe seu nome").max(80),
      phone: z.string().trim().min(1, "informe seu WhatsApp").max(30),
    }),
    address: addressSchema.nullable(),
    tableLabel: optionalText(20),
    payment: z.object({
      method: z.enum(PAYMENT_METHODS),
      changeForCents: z.number().int().positive().max(MAX_ORDER_CENTS).nullable(),
    }),
    notes: optionalText(300),
    expectedTotalCents: z.number().int().nonnegative().max(MAX_ORDER_CENTS).nullable(),
  })
  .superRefine((input, ctx) => {
    if (input.fulfillment === "delivery" && !input.address) {
      ctx.addIssue({ code: "custom", message: "informe o endereço de entrega", path: ["address"] });
    }
    if (input.fulfillment === "dine_in" && !input.tableLabel) {
      ctx.addIssue({ code: "custom", message: "informe a mesa", path: ["tableLabel"] });
    }
    if (input.payment.method !== "cash" && input.payment.changeForCents !== null) {
      ctx.addIssue({ code: "custom", message: "troco só para pagamento em dinheiro", path: ["payment", "changeForCents"] });
    }
  });

export type CheckoutInput = z.input<typeof checkoutInputSchema>;
export type ParsedCheckout = z.output<typeof checkoutInputSchema>;
